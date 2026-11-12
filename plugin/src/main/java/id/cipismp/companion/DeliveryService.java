package id.cipismp.companion;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/** Eksekusi perintah pengiriman di main thread, dengan fallback antrean offline. */
public final class DeliveryService {
    private final JavaPlugin plugin;
    private final QueueStore queue;
    private final LuckPermsHook luckPerms;
    private final ExecutionGuard executionGuard;

    public DeliveryService(JavaPlugin plugin, QueueStore queue, LuckPermsHook luckPerms) {
        this.plugin = plugin;
        this.queue = queue;
        this.luckPerms = luckPerms;
        this.executionGuard = new ExecutionGuard(plugin.getDataFolder().toPath());
    }

    public record Result(boolean ok, int applied, List<Map<String, String>> failed, String message) {
        public static Result ok(int applied) {
            return new Result(true, applied, List.of(), null);
        }

        public static Result queued() {
            return new Result(true, 0, List.of(), "Pemain offline; perintah diantrekan sampai login berikutnya.");
        }

        public static Result error(String message) {
            return new Result(false, 0, List.of(), message);
        }
    }

    public int pendingCount() {
        return queue.totalPending();
    }

    public boolean luckPermsActive() {
        return luckPerms != null;
    }

    public Result deliver(Delivery delivery) {
        Integer completed = queue.completedApplied(delivery.deliveryId());
        if (completed != null) {
            return queue.markCompleted(delivery.deliveryId(), completed)
                    ? Result.ok(completed)
                    : Result.error("Pengiriman sudah dijalankan tetapi status idempoten gagal disimpan ke disk.");
        }

        UUID uuid;
        try {
            uuid = UUID.fromString(delivery.uuid());
        } catch (IllegalArgumentException e) {
            return Result.error("UUID pemain tidak valid");
        }
        if (!CommandSafety.allowed(delivery.commands(), delivery.player(), uuid)) {
            return Result.error("Perintah atau target tidak sesuai daftar aman; perlu rekonsiliasi staf.");
        }
        Player player = Bukkit.getPlayer(uuid);
        if (player == null || !player.isOnline()) {
            if (!queue.enqueue(delivery)) return Result.error("Antrean lokal plugin penuh; pengiriman akan dicoba lagi.");
            plugin.getLogger().info("Pengiriman " + delivery.deliveryId() + " diantrekan untuk " + delivery.player() + ".");
            return Result.queued();
        }
        Result result = executeGuarded(delivery, player);
        if (result.ok() && !queue.removeCompleted(delivery.uuid(), delivery.deliveryId())) {
            plugin.getLogger().warning("Marker tersimpan tetapi antrean " + delivery.deliveryId() + " belum bisa dibersihkan.");
        }
        return result;
    }

    /** Kirim pengiriman kit tertunda; perubahan rank menunggu lease website baru. */
    public void flushQueued(Player player) {
        List<Delivery> pending = queue.pending(player.getUniqueId().toString());
        if (pending.isEmpty()) return;
        plugin.getLogger().info("Mengirim " + pending.size() + " pengiriman tertunda untuk " + player.getName() + ".");
        for (Delivery delivery : pending) {
            Integer completed = queue.completedApplied(delivery.deliveryId());
            // An old offline copy can outlive a new staff restriction, cancellation,
            // or the website's retry state. Never execute a rank change from that
            // copy; wait for a fresh website poll/lease and its current checks.
            if (completed == null && CommandSafety.needsFreshRankLease(delivery.commands())) {
                plugin.getLogger().info("Rank " + delivery.deliveryId() + " menunggu pemeriksaan ulang dan lease website; tidak dijalankan dari antrean lokal.");
                continue;
            }
            Result result = completed != null ? Result.ok(completed) : executeGuarded(delivery, player);
            if (result.ok()) {
                if (!queue.markCompleted(delivery.deliveryId(), result.applied())) {
                    plugin.getLogger().severe("Perintah " + delivery.deliveryId()
                            + " telah dijalankan tetapi marker gagal disimpan; perlu pemeriksaan manual sebelum restart.");
                } else if (!queue.removeCompleted(delivery.uuid(), delivery.deliveryId())) {
                    plugin.getLogger().warning("Marker tersimpan tetapi antrean " + delivery.deliveryId() + " belum bisa dibersihkan.");
                }
            } else {
                plugin.getLogger().warning("Pengiriman " + delivery.deliveryId() + " gagal dan tetap berada dalam antrean.");
            }
        }
    }

    /** Never replay a possibly applied command after crash, partial failure or timeout. */
    private Result executeGuarded(Delivery delivery, Player player) {
        Integer completed = queue.completedApplied(delivery.deliveryId());
        if (completed != null) return Result.ok(completed);
        // Also protect deliveries persisted by an older plugin, and recheck the
        // actual online UUID/name before creating an execution marker.
        if (!player.getUniqueId().toString().equalsIgnoreCase(delivery.uuid())
                || !CommandSafety.allowed(delivery.commands(), player.getName(), player.getUniqueId())) {
            return Result.error("Perintah atau target tidak sesuai daftar aman; perlu rekonsiliasi staf.");
        }
        if (luckPerms == null && delivery.commands().stream().anyMatch(c -> c.toLowerCase(java.util.Locale.ROOT).contains(" parent "))) {
            return Result.error("API LuckPerms tidak tersedia; perubahan group dibatalkan.");
        }
        try {
            if (!executionGuard.begin(delivery.deliveryId())) {
                return Result.error("Pengiriman mungkin sudah dijalankan; perlu rekonsiliasi manual sebelum mencoba ulang.");
            }
        } catch (java.io.IOException e) {
            plugin.getLogger().severe("Gagal menyimpan marker sebelum pengiriman " + delivery.deliveryId() + "; perintah tidak dijalankan: " + e.getMessage());
            return Result.error("Marker pengiriman tidak dapat disimpan; perlu pemeriksaan staf.");
        }
        Result result = runOnMainThread(delivery, player);
        if (result.ok() && !queue.markCompleted(delivery.deliveryId(), result.applied())) {
            return Result.error("Perintah dijalankan tetapi status selesai gagal disimpan; perlu rekonsiliasi manual.");
        }
        if (!result.ok()) {
            plugin.getLogger().severe("Hasil pengiriman " + delivery.deliveryId() + " tidak pasti atau sebagian gagal; hentikan retry dan rekonsiliasi manual.");
        }
        return result;
    }

    private Result runOnMainThread(Delivery delivery, Player player) {
        CompletableFuture<Result> future = new CompletableFuture<>();
        Runnable execute = () -> {
            List<Map<String, String>> failures = new ArrayList<>();
            int applied = 0;
            for (String raw : delivery.commands()) {
                String command = Placeholders.apply(raw, player);
                try {
                    if (command.toLowerCase(java.util.Locale.ROOT).contains(" parent ") && luckPerms == null) {
                        throw new IllegalStateException("API LuckPerms tidak tersedia; perubahan group dibatalkan.");
                    }
                    boolean handled = luckPerms != null && luckPerms.handle(player.getUniqueId(), player.getName(), command);
                    if (!handled && !Bukkit.dispatchCommand(Bukkit.getConsoleSender(), command)) {
                        Map<String, String> failure = new LinkedHashMap<>();
                        failure.put("command", raw);
                        failure.put("error", "Perintah ditolak server");
                        failures.add(failure);
                        break;
                    }
                    applied++;
                } catch (Exception e) {
                    Map<String, String> failure = new LinkedHashMap<>();
                    failure.put("command", raw);
                    failure.put("error", e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage());
                    failures.add(failure);
                    break;
                }
            }
            future.complete(new Result(failures.isEmpty(), applied, failures, failures.isEmpty() ? null : "Sebagian perintah gagal"));
        };
        if (Bukkit.isPrimaryThread()) execute.run();
        else Bukkit.getScheduler().runTask(plugin, execute);
        try {
            return future.get(15, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Result.error("Eksekusi dibatalkan");
        } catch (ExecutionException | TimeoutException e) {
            return Result.error("Eksekusi perintah timeout");
        }
    }
}
