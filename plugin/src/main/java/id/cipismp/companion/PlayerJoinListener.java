package id.cipismp.companion;

import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.plugin.java.JavaPlugin;

/** Membersihkan marker selesai; pengiriman menunggu lease website baru setelah login. */
public final class PlayerJoinListener implements Listener {
    private final JavaPlugin plugin;
    private final DeliveryService deliveries;

    public PlayerJoinListener(JavaPlugin plugin, DeliveryService deliveries) {
        this.plugin = plugin;
        this.deliveries = deliveries;
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onJoin(PlayerJoinEvent event) {
        // Tunda satu detik sebelum memeriksa salinan lokal; tidak mengeksekusi perintah.
        org.bukkit.Bukkit.getScheduler().runTaskLater(
                plugin, () -> deliveries.flushQueued(event.getPlayer()), 20L);
    }
}
