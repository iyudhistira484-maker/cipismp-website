package id.cipismp.companion;

import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Level;

/**
 * Antrean persisten: pengiriman untuk pemain yang sedang offline disimpan ke disk
 * agar tidak hilang saat server restart, lalu dikirim ketika pemain login.
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
        this.data = YamlConfiguration.loadConfiguration(file);
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
        pruneCompleted();
        return save();
    }

    /** Remove an in-memory completion marker when its disk write failed and it must be retried. */
    public synchronized void forgetCompleted(String deliveryId) {
        data.set("completed." + deliveryId, null);
        save();
    }

    private void pruneCompleted() {
        ConfigurationSection section = data.getConfigurationSection("completed");
        if (section == null) return;
        List<String> completed = new ArrayList<>(section.getKeys(false));
        if (completed.size() <= 2000) return;
        completed.sort((left, right) -> Long.compare(
                data.getLong("completed." + left + ".at", 0L),
                data.getLong("completed." + right + ".at", 0L)));
        for (int i = 0; i < completed.size() - 2000; i++) {
            data.set("completed." + completed.get(i), null);
        }
    }

    public synchronized List<Delivery> drain(String uuid) {
        String base = key(uuid);
        List<String> ids = data.getStringList(base + ".ids");
        String player = data.getString(base + ".player", "");
        List<Delivery> out = new ArrayList<>();
        for (String id : ids) {
            String entry = base + ".entries." + id;
            List<String> commands = data.getStringList(entry + ".commands");
            out.add(new Delivery(id, uuid, player, commands, data.getString(entry + ".reason", "PURCHASE")));
        }
        remove(uuid);
        return out;
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

    private void remove(String uuid) {
        data.set(key(uuid), null);
        save();
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
            data.save(file);
            return true;
        } catch (IOException e) {
            plugin.getLogger().log(Level.SEVERE, "Gagal menyimpan antrean pengiriman", e);
            return false;
        }
    }
}
