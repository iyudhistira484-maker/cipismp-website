package id.cipismp.companion;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

public final class AdminCommand implements CommandExecutor {
    private final JavaPlugin plugin;
    private final QueueStore queue;
    private final DeliveryService deliveries;

    public AdminCommand(JavaPlugin plugin, QueueStore queue, DeliveryService deliveries) {
        this.plugin = plugin;
        this.queue = queue;
        this.deliveries = deliveries;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length == 0) {
            sender.sendMessage(Component.text("Pakai: /cipistore <queue|flush|reload>", NamedTextColor.YELLOW));
            return true;
        }
        switch (args[0].toLowerCase()) {
            case "queue" -> sender.sendMessage(Component.text(
                    "Pengiriman tertunda: " + queue.totalPending(), NamedTextColor.GRAY));
            case "flush" -> {
                if (args.length < 2) {
                    sender.sendMessage(Component.text("Pakai: /cipistore flush <pemain>", NamedTextColor.YELLOW));
                    return true;
                }
                Player target = Bukkit.getPlayerExact(args[1]);
                if (target == null) {
                    sender.sendMessage(Component.text("Pemain tidak online.", NamedTextColor.RED));
                    return true;
                }
                int before = queue.pendingFor(target.getUniqueId().toString());
                deliveries.flushQueued(target);
                sender.sendMessage(Component.text("Memeriksa " + before + " pengiriman tertunda untuk "
                        + target.getName() + "; rank menunggu pemeriksaan ulang website.", NamedTextColor.GREEN));
            }
            case "reload" -> {
                plugin.reloadConfig();
                sender.sendMessage(Component.text("Konfigurasi dibaca ulang. Perubahan website-url, secret, "
                        + "polling, atau live-status membutuhkan restart server.", NamedTextColor.GREEN));
            }
            default -> sender.sendMessage(Component.text("Subperintah tidak dikenal.", NamedTextColor.RED));
        }
        return true;
    }
}
