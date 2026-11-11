package id.cipismp.companion;

import org.bukkit.entity.Player;

/** Placeholder yang didukung di template perintah toko. */
public final class Placeholders {
    private Placeholders() {}

    public static String apply(String template, Player player) {
        return template
                .replace("{player}", player.getName())
                .replace("{uuid}", player.getUniqueId().toString())
                .replace("{displayname}", player.getDisplayName())
                .replace("{world}", player.getWorld().getName());
    }
}
