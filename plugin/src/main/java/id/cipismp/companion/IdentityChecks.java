package id.cipismp.companion;

import java.lang.reflect.Method;
import java.util.UUID;

/** Reflects the installed plugin APIs; any missing or unexpected result fails closed. */
final class IdentityChecks {
    private IdentityChecks() {}

    static boolean loggedIn(Class<?> loginSecurityClass, Class<?> playerType, Object player) {
        try {
            Object manager = loginSecurityClass.getMethod("getSessionManager").invoke(null);
            if (manager == null) return false;
            Object session = manager.getClass().getMethod("getPlayerSession", playerType).invoke(manager, player);
            if (session == null) return false;
            return Boolean.TRUE.equals(session.getClass().getMethod("isLoggedIn").invoke(session));
        } catch (ReflectiveOperationException | RuntimeException | LinkageError e) {
            return false;
        }
    }

    static Boolean isFloodgatePlayer(Class<?> apiClass, UUID uuid) {
        try {
            Object api = apiClass.getMethod("getInstance").invoke(null);
            if (api == null) return null;
            Method method = apiClass.getMethod("isFloodgatePlayer", UUID.class);
            Object result = method.invoke(api, uuid);
            return result instanceof Boolean ? (Boolean) result : null;
        } catch (ReflectiveOperationException | RuntimeException | LinkageError e) {
            return null;
        }
    }
}
