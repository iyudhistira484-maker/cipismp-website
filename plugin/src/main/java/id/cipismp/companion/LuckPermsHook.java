package id.cipismp.companion;

import net.luckperms.api.LuckPerms;
import net.luckperms.api.model.group.Group;
import net.luckperms.api.model.user.User;
import net.luckperms.api.node.NodeType;
import net.luckperms.api.node.types.InheritanceNode;
import org.bukkit.Bukkit;
import org.bukkit.plugin.RegisteredServiceProvider;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.logging.Logger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Menjalankan perubahan rank lewat API LuckPerms bila tersedia, sehingga
 * `lp user <player> parent add|remove <group>` tidak perlu menunggu eksekusi
 * perintah konsol dan hasilnya atomik. Perintah lain tetap lewat konsol.
 */
public final class LuckPermsHook {
    private static final Pattern PARENT_ADD = Pattern.compile("^lp\\s+user\\s+(\\S+)\\s+parent\\s+add\\s+(\\S+)$");
    private static final Pattern PARENT_REMOVE = Pattern.compile("^lp\\s+user\\s+(\\S+)\\s+parent\\s+remove\\s+(\\S+)$");

    private final LuckPerms api;
    private final Logger logger;

    private LuckPermsHook(LuckPerms api, Logger logger) {
        this.api = api;
        this.logger = logger;
    }

    public static LuckPermsHook tryHook(Logger logger) {
        try {
            if (Bukkit.getPluginManager().getPlugin("LuckPerms") == null) return null;
            RegisteredServiceProvider<LuckPerms> provider = Bukkit.getServicesManager().getRegistration(LuckPerms.class);
            if (provider == null) return null;
            return new LuckPermsHook(provider.getProvider(), logger);
        } catch (Throwable t) {
            logger.warning("LuckPerms terpasang tetapi API tidak bisa dipakai: " + t.getMessage());
            return null;
        }
    }

    /** @return true bila perintah ditangani lewat API (tidak perlu dispatch konsol). */
    public boolean handle(UUID uuid, String playerName, String command) {
        String normalized = command.trim().replaceAll("\\s+", " ");
        Matcher add = PARENT_ADD.matcher(normalized);
        if (add.matches()) return apply(uuid, playerName, add.group(2), true);
        Matcher remove = PARENT_REMOVE.matcher(normalized);
        if (remove.matches()) return apply(uuid, playerName, remove.group(2), false);
        return false;
    }

    private boolean apply(UUID uuid, String playerName, String groupName, boolean grant) {
        Group group = api.getGroupManager().getGroup(groupName);
        if (group == null) {
            logger.warning("Grup LuckPerms '" + groupName + "' tidak ada; perintah diteruskan ke konsol.");
            return false;
        }
        try {
            CompletableFuture<User> future = api.getUserManager().loadUser(uuid, playerName);
            User user = future.join();
            InheritanceNode node = InheritanceNode.builder(group).build();
            if (grant) {
                user.data().add(node);
            } else {
                user.data().clear(n -> n.getType() == NodeType.INHERITANCE && n.getKey().equals(node.getKey()));
            }
            api.getUserManager().saveUser(user).join();
            return true;
        } catch (Exception e) {
            logger.warning("Gagal mengubah grup LuckPerms untuk " + playerName + ": " + e.getMessage());
            return false;
        }
    }
}
