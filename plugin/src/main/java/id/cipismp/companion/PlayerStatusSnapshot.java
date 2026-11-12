package id.cipismp.companion;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.java.JavaPlugin;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/** Read-only observations, collected on the server thread; never used for grants. */
public final class PlayerStatusSnapshot {
    private final JavaPlugin plugin;
    private final LuckPermsHook luckPerms;
    private final List<String> kitNames;
    private int cursor;
    private boolean warned;

    public PlayerStatusSnapshot(JavaPlugin plugin, LuckPermsHook luckPerms, List<String> configuredNames) {
        this.plugin = plugin;
        this.luckPerms = luckPerms;
        this.kitNames = configuredNames.stream().filter(n -> n != null && n.matches("[A-Za-z0-9_+.-]{1,64}"))
                .distinct().limit(5).toList();
    }

    /** Must be invoked on Bukkit's primary thread. */
    public JsonObject collect() {
        if (!Bukkit.isPrimaryThread()) throw new IllegalStateException("Status must be collected on the server thread");
        List<Player> players = new ArrayList<>(Bukkit.getOnlinePlayers());
        players.sort(Comparator.comparing(p -> p.getUniqueId().toString()));
        JsonObject payload = new JsonObject();
        payload.addProperty("observedAt", System.currentTimeMillis());
        JsonArray snapshots = new JsonArray();
        if (players.isEmpty()) { payload.add("players", snapshots); return payload; }
        int start = Math.floorMod(cursor, players.size());
        int count = Math.min(players.size(), 50);
        for (int i = 0; i < count; i++) {
            Player player = players.get((start + i) % players.size());
            JsonObject row = new JsonObject();
            UUID uuid = player.getUniqueId();
            row.addProperty("uuid", uuid.toString());
            String group = safeText(luckPerms == null ? null : luckPerms.primaryGroup(uuid), 64);
            if (group == null) row.add("primaryGroup", null); else row.addProperty("primaryGroup", group);
            JsonArray kits = new JsonArray();
            for (String kit : kitNames) {
                JsonObject item = new JsonObject();
                item.addProperty("name", kit);
                String cooldown = readCooldown(player, kit);
                if (cooldown == null) item.add("cooldown", null); else item.addProperty("cooldown", cooldown);
                kits.add(item);
            }
            row.add("kits", kits);
            snapshots.add(row);
        }
        cursor = (start + count) % players.size();
        payload.add("players", snapshots);
        return payload;
    }

    private String readCooldown(Player player, String kit) {
        Plugin source = Bukkit.getPluginManager().getPlugin("PlayerKits2");
        // API and data-loading semantics were inspected for this exact plugin version only.
        if (source == null || !source.isEnabled() || !"1.23.1".equals(source.getDescription().getVersion())) return null;
        try {
            Object manager = source.getClass().getMethod("getPlayerDataManager").invoke(source);
            if (manager == null || manager.getClass().getMethod("getPlayerByUUID", UUID.class).invoke(manager, player.getUniqueId()) == null) return null;
            Class<?> api = source.getClass().getClassLoader().loadClass("pk.ajneb97.api.PlayerKitsAPI");
            Method method = api.getMethod("getKitCooldown", Player.class, String.class);
            Object result = method.invoke(null, player, kit);
            return result instanceof String ? safeText((String) result, 160) : null;
        } catch (ReflectiveOperationException | RuntimeException | LinkageError e) {
            if (!warned) {
                warned = true;
                plugin.getLogger().warning("Pembacaan PlayerKits2 tidak tersedia; cooldown tidak akan ditebak: " + e.getClass().getSimpleName());
            }
            return null;
        }
    }

    private static String safeText(String raw, int limit) {
        if (raw == null) return null;
        String value = ChatColor.stripColor(raw);
        if (value == null) return null;
        value = value.replaceAll("[\\p{Cntrl}]", " ").trim();
        return value.isEmpty() || value.length() > limit ? null : value;
    }
}
