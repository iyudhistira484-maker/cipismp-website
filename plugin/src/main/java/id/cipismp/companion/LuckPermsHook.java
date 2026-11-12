package id.cipismp.companion;

import net.luckperms.api.LuckPerms;
import net.luckperms.api.model.group.Group;
import net.luckperms.api.model.user.User;
import net.luckperms.api.node.NodeType;
import net.luckperms.api.node.types.InheritanceNode;
import net.luckperms.api.model.PermissionHolder;
import net.luckperms.api.query.Flag;
import net.luckperms.api.query.QueryOptions;
import org.bukkit.Bukkit;
import org.bukkit.plugin.RegisteredServiceProvider;

import java.util.UUID;
import java.util.EnumSet;
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
    private static final Pattern PARENT_ADD = Pattern.compile("^lp\\s+user\\s+(\\S+)\\s+parent\\s+add\\s+(\\S+)$", Pattern.CASE_INSENSITIVE);
    private static final Pattern PARENT_REMOVE = Pattern.compile("^lp\\s+user\\s+(\\S+)\\s+parent\\s+remove\\s+(\\S+)$", Pattern.CASE_INSENSITIVE);

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

    /** Only report already-loaded online users; never block the game thread on a database load. */
    public String primaryGroup(UUID uuid) {
        try {
            User user = api.getUserManager().getUser(uuid);
            return user == null ? null : user.getPrimaryGroup();
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** @return true bila perintah ditangani lewat API (tidak perlu dispatch konsol). */
    public boolean handle(UUID uuid, String playerName, String command) {
        String normalized = command.trim().replaceAll("\\s+", " ");
        Matcher add = PARENT_ADD.matcher(normalized);
        if (add.matches()) {
            requireTarget(uuid, playerName, add.group(1));
            apply(uuid, playerName, add.group(2), true);
            return true;
        }
        Matcher remove = PARENT_REMOVE.matcher(normalized);
        if (remove.matches()) {
            requireTarget(uuid, playerName, remove.group(1));
            apply(uuid, playerName, remove.group(2), false);
            return true;
        }
        return false;
    }

    private static void requireTarget(UUID uuid, String playerName, String target) {
        if (!target.equalsIgnoreCase(playerName) && !target.equalsIgnoreCase(uuid.toString())) {
            throw new IllegalArgumentException("Target LuckPerms tidak sesuai penerima");
        }
    }

    /** Fail closed across contexts and inherited groups; include even direct negative
     * or expired nodes as conservative evidence requiring human review. */
    private static boolean hasStaffGroup(PermissionHolder holder) {
        if (holder.getNodes(NodeType.INHERITANCE).stream().anyMatch(node -> StaffGroups.contains(node.getGroupName()))) return true;
        QueryOptions options = QueryOptions.nonContextual(EnumSet.allOf(Flag.class));
        return holder.getInheritedGroups(options).stream().anyMatch(inherited -> StaffGroups.contains(inherited.getName()));
    }

    private void apply(UUID uuid, String playerName, String groupName, boolean grant) {
        Group group = api.getGroupManager().getGroup(groupName);
        if (group == null) {
            throw new IllegalStateException("Grup LuckPerms '" + groupName + "' tidak ditemukan; perintah dibatalkan.");
        }
        try {
            CompletableFuture<User> future = api.getUserManager().loadUser(uuid, playerName);
            User user = future.join();
            // Inspect all contexts and both direct/transitive memberships immediately
            // before modifying data. Never change a group for a known staff member,
            // or install a rank group that itself inherits a staff group.
            if (StaffGroups.contains(user.getPrimaryGroup()) || hasStaffGroup(user)
                    || StaffGroups.contains(group.getName()) || hasStaffGroup(group)) {
                throw new IllegalStateException("Penerima atau grup rank terhubung dengan grup staf; perubahan ditahan.");
            }
            InheritanceNode node = InheritanceNode.builder(group).build();
            if (grant) {
                user.data().add(node);
            } else {
                user.data().clear(n -> n.getType() == NodeType.INHERITANCE && n.getKey().equals(node.getKey()));
            }
            api.getUserManager().saveUser(user).join();
        } catch (Exception e) {
            logger.warning("Gagal mengubah grup LuckPerms untuk " + playerName + ": " + e.getMessage());
            throw new IllegalStateException("Gagal menyimpan perubahan LuckPerms; hasil perlu direkonsiliasi.", e);
        }
    }
}
