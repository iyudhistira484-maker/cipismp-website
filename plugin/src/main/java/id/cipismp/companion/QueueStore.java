package id.cipismp.companion;

import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Level;

/**
 * Antrean persisten: pengiriman untuk pemain yang sedang offline disimpan ke disk
 * agar tidak hilang saat server restart; eksekusi menunggu lease baru dari website.
 */
public final class QueueStore {
    private final JavaPlugin plugin;
    private final File file;
    private final int maxPerPlayer;
    private final YamlConfiguration data;

    public QueueStore(JavaPlugin plugin, String fileName, int maxPerPlayer) {
        this.plugin = plugin;
        this.file = new File(plugin.getDataFolder(), fileName);
        this.maxPerPlayer = maxPerPlayer;
        this.data = new YamlConfiguration();
        if (file.exists()) {
            try {
                this.data.load(file);
            } catch (IOException | org.bukkit.configuration.InvalidConfigurationException e) {
                throw new IllegalStateException("Antrean pengiriman rusak atau tidak dapat dibaca; plugin harus dihentikan dan direkonsiliasi.", e);
            }
        }
    }

    public synchronized boolean enqueue(Delivery delivery) {
        if (completedApplied(delivery.deliveryId()) != null) return true;
        String base = key(delivery.uuid());
        List<String> ids = data.getStringList(base + ".ids");
        if (ids.contains(delivery.deliveryId())) return save();
        if (ids.size() >= maxPerPlayer) {
            plugin.getLogger().warning("Antrean " + delivery.player() + " penuh (" + maxPerPlayer + "); pengiriman "
                    + delivery.deliveryId() + " ditolak agar website dapat mencoba lagi.");
            return false;
        }
        ids.add(delivery.deliveryId());
        data.set(base + ".ids", ids);
        data.set(base + ".player", delivery.player());
        data.set(base + ".entries." + delivery.deliveryId() + ".reason", delivery.reason());
        data.set(base + ".entries." + delivery.deliveryId() + ".commands", delivery.commands());
        if (save()) return true;

        // Do not let a retry be mistaken for a durable enqueue after a disk write failure.
        ids.remove(delivery.deliveryId());
        if (ids.isEmpty()) {
            data.set(base, null);
        } else {
            data.set(base + ".ids", ids);
        }
        data.set(base + ".entries." + delivery.deliveryId(), null);
        return false;
    }

    /** Return the applied-command count for a completed delivery, if already executed. */
    public synchronized Integer completedApplied(String deliveryId) {
        String path = "completed." + deliveryId + ".applied";
        return data.isInt(path) ? data.getInt(path) : null;
    }

    /** Persist completion before the remote ACK so a re-polled delivery is not executed twice. */
    public synchronized boolean markCompleted(String deliveryId, int applied) {
        String path = "completed." + deliveryId;
        data.set(path + ".applied", Math.max(0, applied));
        data.set(path + ".at", System.currentTimeMillis());
        // Do not evict markers automatically: an old ACK can be retried later.
        return save();
    }

    /** Remove an in-memory completion marker when its disk write failed and it must be retried. */
    public synchronized void forgetCompleted(String deliveryId) {
        data.set("completed." + deliveryId, null);
        save();
    }

    /** Read without deleting: a crash before execution must not lose acknowledged work. */
    public synchronized List<Delivery> pending(String uuid) {
        String base = key(uuid);
        List<String> ids = data.getStringList(base + ".ids");
        String player = data.getString(base + ".player", "");
        List<Delivery> out = new ArrayList<>();
        for (String id : ids) {
            String entry = base + ".entries." + id;
            List<String> commands = data.getStringList(entry + ".commands");
            out.add(new Delivery(id, uuid, player, commands, data.getString(entry + ".reason", "PURCHASE")));
        }
        return out;
    }

    /** Remove only one delivery after its completion marker is durably written. */
    public synchronized boolean removeCompleted(String uuid, String deliveryId) {
        String base = key(uuid);
        List<String> ids = data.getStringList(base + ".ids");
        if (!ids.contains(deliveryId)) return true;
        List<String> original = new ArrayList<>(ids);
        ids.remove(deliveryId);
        // Keep entries until the save succeeds so the in-memory state can be restored.
        data.set(base + ".ids", ids);
        if (!save()) {
            data.set(base + ".ids", original);
            return false;
        }
        if (ids.isEmpty()) data.set(base, null);
        else data.set(base + ".entries." + deliveryId, null);
        save(); // Optional cleanup; the durable ID list already excludes this delivery.
        return true;
    }

    public synchronized int pendingFor(String uuid) {
        return data.getStringList(key(uuid) + ".ids").size();
    }

    public synchronized int totalPending() {
        ConfigurationSection root = data.getConfigurationSection("players");
        if (root == null) return 0;
        int total = 0;
        for (String uuid : root.getKeys(false)) {
            total += data.getStringList("players." + uuid + ".ids").size();
        }
        return total;
    }

    private static String key(String uuid) {
        return "players." + uuid.toLowerCase();
    }

    private boolean save() {
        try {
            if (!plugin.getDataFolder().exists() && !plugin.getDataFolder().mkdirs()) {
                plugin.getLogger().warning("Tidak bisa membuat folder data plugin.");
                return false;
            }
            var tmp = Files.createTempFile(plugin.getDataFolder().toPath(), "queue-", ".tmp");
            try {
                Files.writeString(tmp, data.saveToString(), StandardCharsets.UTF_8);
                try {
                    Files.move(tmp, file.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
                } catch (AtomicMoveNotSupportedException e) {
                    Files.move(tmp, file.toPath(), StandardCopyOption.REPLACE_EXISTING);
                }
            } finally {
                Files.deleteIfExists(tmp);
            }
            return true;
        } catch (IOException e) {
            plugin.getLogger().log(Level.SEVERE, "Gagal menyimpan antrean pengiriman", e);
            return false;
        }
    }
}
