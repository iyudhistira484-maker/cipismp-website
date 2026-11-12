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
    private final PlayerIdentity identity;

    public VerifyCommand(JavaPlugin plugin, VerifyService service, PlayerIdentity identity) {
        this.plugin = plugin;
        this.service = service;
        this.identity = identity;
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
        if (!identity.loggedIn(player)) {
            player.sendMessage(Component.text("Login terlebih dahulu. Jika sudah login, hubungi staf untuk memeriksa LoginSecurity.", NamedTextColor.RED));
            return true;
        }
        String edition = identity.edition(player);
        if (edition == null) {
            player.sendMessage(Component.text("Verifikasi ditahan: Floodgate tidak tersedia. Hubungi staf.", NamedTextColor.RED));
            return true;
        }
        String code = args[0].trim().toUpperCase(java.util.Locale.ROOT);
        String uuid = player.getUniqueId().toString();
        String playerName = player.getName();
        player.sendMessage(Component.text("Memeriksa kode...", NamedTextColor.GRAY));

        plugin.getServer().getScheduler().runTaskAsynchronously(plugin, () -> {
            // Check again immediately before transmitting the one-time code.
            if (!identity.sameAuthenticatedIdentityOnMainThread(player, uuid, playerName, edition)) return;
            VerifyService.Outcome outcome = service.verify(uuid, playerName, edition, code);
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
