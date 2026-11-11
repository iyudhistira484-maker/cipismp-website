package id.cipismp.companion;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

public final class VerifyCommand implements CommandExecutor {
    private final JavaPlugin plugin;
    private final VerifyService service;

    public VerifyCommand(JavaPlugin plugin, VerifyService service) {
        this.plugin = plugin;
        this.service = service;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage("Perintah ini hanya bisa dipakai di dalam game.");
            return true;
        }
        if (args.length != 1) {
            player.sendMessage(Component.text("Pakai: /verify <kode dari dashboard>", NamedTextColor.YELLOW));
            return true;
        }
        String code = args[0].trim().toUpperCase();
        player.sendMessage(Component.text("Memeriksa kode...", NamedTextColor.GRAY));

        plugin.getServer().getScheduler().runTaskAsynchronously(plugin, () -> {
            VerifyService.Outcome outcome = service.verify(player, code);
            plugin.getServer().getScheduler().runTask(plugin, () -> {
                if (!player.isOnline()) return;
                player.sendMessage(outcome.ok()
                        ? Component.text(outcome.message(), NamedTextColor.GREEN)
                        : Component.text(outcome.message(), NamedTextColor.RED));
            });
        });
        return true;
    }
}
