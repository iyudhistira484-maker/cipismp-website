package id.cipismp.companion;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.concurrent.TimeUnit;

/** LoginSecurity is mandatory for Java and Bedrock; Floodgate determines edition. */
final class PlayerIdentity {
    private final JavaPlugin plugin;
    PlayerIdentity(JavaPlugin plugin) { this.plugin = plugin; }

    /** Only call on the Bukkit primary thread. Bypass/unregistered sessions are not sufficient. */
    boolean loggedIn(Player player) {
        if (!Bukkit.isPrimaryThread() || player == null || !player.isOnline() || Bukkit.getPlayer(player.getUniqueId()) != player) return false;
        Plugin login = Bukkit.getPluginManager().getPlugin("LoginSecurity");
        if (login == null || !login.isEnabled()) return false;
        return IdentityChecks.loggedIn(login.getClass(), Player.class, player);
    }

    Player findOnlinePlayer(java.util.UUID uuid) {
        if (Bukkit.isPrimaryThread()) return Bukkit.getPlayer(uuid);
        try { return Bukkit.getScheduler().callSyncMethod(plugin, () -> Bukkit.getPlayer(uuid)).get(5, TimeUnit.SECONDS); }
        catch (InterruptedException e) { Thread.currentThread().interrupt(); return null; }
        catch (Exception e) { return null; }
    }

    boolean loggedInOnMainThread(Player player) {
        if (Bukkit.isPrimaryThread()) return loggedIn(player);
        try {
            return Bukkit.getScheduler().callSyncMethod(plugin, () -> loggedIn(player)).get(5, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        } catch (Exception e) { return false; }
    }

    boolean sameAuthenticatedIdentityOnMainThread(Player player, String uuid, String name, String edition) {
        java.util.concurrent.Callable<Boolean> check = () -> loggedIn(player)
                && player.getUniqueId().toString().equalsIgnoreCase(uuid)
                && player.getName().equals(name) && edition.equals(edition(player));
        try {
            if (Bukkit.isPrimaryThread()) return check.call();
            return Bukkit.getScheduler().callSyncMethod(plugin, check).get(5, TimeUnit.SECONDS);
        } catch (InterruptedException e) { Thread.currentThread().interrupt(); return false; }
        catch (Exception e) { return false; }
    }

    /** Structural readiness is not a substitute for a real staging/runtime test. */
    boolean ready() {
        if (!Bukkit.isPrimaryThread()) return false;
        Plugin login = Bukkit.getPluginManager().getPlugin("LoginSecurity");
        Plugin floodgate = Bukkit.getPluginManager().getPlugin("floodgate");
        if (login == null || !login.isEnabled() || floodgate == null || !floodgate.isEnabled()) return false;
        try {
            Object manager = login.getClass().getMethod("getSessionManager").invoke(null);
            if (manager == null) return false;
            Class<?> sessionClass = manager.getClass().getMethod("getPlayerSession", Player.class).getReturnType();
            sessionClass.getMethod("isLoggedIn");
            Class<?> api = Class.forName("org.geysermc.floodgate.api.FloodgateApi", true, floodgate.getClass().getClassLoader());
            if (api.getMethod("getInstance").invoke(null) == null) return false;
            api.getMethod("isFloodgatePlayer", java.util.UUID.class);
            return true;
        } catch (ReflectiveOperationException | RuntimeException | LinkageError e) { return false; }
    }

    boolean readyOnMainThread() {
        if (Bukkit.isPrimaryThread()) return ready();
        try { return Bukkit.getScheduler().callSyncMethod(plugin, this::ready).get(5, TimeUnit.SECONDS); }
        catch (InterruptedException e) { Thread.currentThread().interrupt(); return false; }
        catch (Exception e) { return false; }
    }

    /** Returns null if Floodgate is unavailable, disabled or its API cannot be checked. */
    String edition(Player player) {
        if (!Bukkit.isPrimaryThread() || player == null || !player.isOnline()) return null;
        Plugin floodgate = Bukkit.getPluginManager().getPlugin("floodgate");
        if (floodgate == null || !floodgate.isEnabled()) return null;
        try {
            Class<?> api = Class.forName("org.geysermc.floodgate.api.FloodgateApi", true, floodgate.getClass().getClassLoader());
            Boolean bedrock = IdentityChecks.isFloodgatePlayer(api, player.getUniqueId());
            return bedrock == null ? null : bedrock ? "BEDROCK" : "JAVA";
        } catch (ClassNotFoundException | LinkageError | RuntimeException e) { return null; }
    }
}
