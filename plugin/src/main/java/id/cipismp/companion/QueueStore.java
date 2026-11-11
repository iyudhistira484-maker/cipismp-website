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

    public synchronized void enqueue(Delivery delivery) {
        List<String> ids = data.getStringList(key(delivery.uuid()) + ".ids");
        if (ids.size() >= maxPerPlayer) {
            plugin.getLogger().warning("Antrean " + delivery.player() + " penuh (" + maxPerPlayer + "); pengiriman "
                    + delivery.deliveryId() + " dilewati dan harus dikirim ulang dari panel admin.");
            return;
        }
        ids.add(delivery.deliveryId());
        data.set(key(delivery.uuid()) + ".ids", ids);
        data.set(key(delivery.uuid()) + ".player", delivery.player());
        data.set(key(delivery.uuid()) + ".entries." + delivery.deliveryId() + ".reason", delivery.reason());
        data.set(key(delivery.uuid()) + ".entries." + delivery.deliveryId() + ".commands", delivery.commands());
        save();
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

    private void save() {
        try {
            if (!plugin.getDataFolder().exists() && !plugin.getDataFolder().mkdirs()) {
                plugin.getLogger().warning("Tidak bisa membuat folder data plugin.");
            }
            data.save(file);
        } catch (IOException e) {
            plugin.getLogger().log(Level.SEVERE, "Gagal menyimpan antrean pengiriman", e);
        }
    }
}
