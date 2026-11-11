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

    public DeliveryService(JavaPlugin plugin, QueueStore queue, LuckPermsHook luckPerms) {
        this.plugin = plugin;
        this.queue = queue;
        this.luckPerms = luckPerms;
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
        Player player = Bukkit.getPlayer(uuid);
        if (player == null || !player.isOnline()) {
            if (!queue.enqueue(delivery)) return Result.error("Antrean lokal plugin penuh; pengiriman akan dicoba lagi.");
            plugin.getLogger().info("Pengiriman " + delivery.deliveryId() + " diantrekan untuk " + delivery.player() + ".");
            return Result.queued();
        }
        Result result = runOnMainThread(delivery, player);
        if (result.ok() && !queue.markCompleted(delivery.deliveryId(), result.applied())) {
            return Result.error("Perintah dijalankan tetapi status idempoten gagal disimpan ke disk.");
        }
        return result;
    }

    /** Kirim semua pengiriman tertunda untuk pemain yang baru login. */
    public void flushQueued(Player player) {
        List<Delivery> pending = queue.drain(player.getUniqueId().toString());
        if (pending.isEmpty()) return;
        plugin.getLogger().info("Mengirim " + pending.size() + " pengiriman tertunda untuk " + player.getName() + ".");
        for (Delivery delivery : pending) {
            Result result = runOnMainThread(delivery, player);
            if (result.ok()) {
                if (!queue.markCompleted(delivery.deliveryId(), result.applied())) {
                    plugin.getLogger().severe("Status idempoten " + delivery.deliveryId()
                            + " gagal disimpan; pengiriman dikembalikan ke antrean.");
                    queue.forgetCompleted(delivery.deliveryId());
                    queue.enqueue(delivery);
                }
            } else {
                // Kembalikan ke antrean agar dicoba lagi pada login berikutnya.
                queue.enqueue(delivery);
            }
        }
    }

    private Result runOnMainThread(Delivery delivery, Player player) {
        CompletableFuture<Result> future = new CompletableFuture<>();
        Runnable execute = () -> {
            List<Map<String, String>> failures = new ArrayList<>();
            int applied = 0;
            for (String raw : delivery.commands()) {
                String command = Placeholders.apply(raw, player);
                try {
                    boolean handled = luckPerms != null && luckPerms.handle(player.getUniqueId(), player.getName(), command);
                    if (!handled && !Bukkit.dispatchCommand(Bukkit.getConsoleSender(), command)) {
                        Map<String, String> failure = new LinkedHashMap<>();
                        failure.put("command", raw);
                        failure.put("error", "Perintah ditolak server");
                        failures.add(failure);
                        continue;
                    }
                    applied++;
                } catch (Exception e) {
                    Map<String, String> failure = new LinkedHashMap<>();
                    failure.put("command", raw);
                    failure.put("error", e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage());
                    failures.add(failure);
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
