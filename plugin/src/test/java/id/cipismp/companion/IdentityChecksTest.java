package id.cipismp.companion;

import org.junit.jupiter.api.Test;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class IdentityChecksTest {
    public static class FakePlayer {}
    public static class Session {
        private final boolean loggedIn;
        Session(boolean loggedIn) { this.loggedIn = loggedIn; }
        public boolean isLoggedIn() { return loggedIn; }
    }
    public static class Manager {
        Session session;
        public Session getPlayerSession(FakePlayer player) { return session; }
    }
    public static class LoginApi {
        static Manager manager;
        public static Manager getSessionManager() { return manager; }
    }
    public static class BrokenLoginApi {
        public static Object getSessionManager() { throw new IllegalStateException("offline"); }
    }
    public interface FloodgateApi {
        static FloodgateApi getInstance() { return FloodgateHolder.api; }
        boolean isFloodgatePlayer(UUID uuid);
    }
    static class FloodgateHolder { static FloodgateApi api; }

    @Test void requiresLoginSecurityRegisteredAuthenticatedSessionAndFailsClosed() {
        FakePlayer player = new FakePlayer();
        LoginApi.manager = null;
        assertFalse(IdentityChecks.loggedIn(LoginApi.class, FakePlayer.class, player));
        LoginApi.manager = new Manager();
        assertFalse(IdentityChecks.loggedIn(LoginApi.class, FakePlayer.class, player));
        LoginApi.manager.session = new Session(false);
        assertFalse(IdentityChecks.loggedIn(LoginApi.class, FakePlayer.class, player));
        LoginApi.manager.session = new Session(true);
        assertTrue(IdentityChecks.loggedIn(LoginApi.class, FakePlayer.class, player));
        assertFalse(IdentityChecks.loggedIn(BrokenLoginApi.class, FakePlayer.class, player));
        assertFalse(IdentityChecks.loggedIn(String.class, FakePlayer.class, player));
    }

    @Test void queriesFloodgateApiRatherThanInferringUuidVersionOrName() {
        UUID javaOffline = UUID.fromString("170da219-5ca8-3e57-a874-76123098b905");
        UUID bedrock = UUID.fromString("00000000-0000-0000-0009-01fd62950c17");
        FloodgateHolder.api = id -> id.equals(bedrock);
        assertEquals(Boolean.FALSE, IdentityChecks.isFloodgatePlayer(FloodgateApi.class, javaOffline));
        assertEquals(Boolean.TRUE, IdentityChecks.isFloodgatePlayer(FloodgateApi.class, bedrock));
        FloodgateHolder.api = null;
        assertNull(IdentityChecks.isFloodgatePlayer(FloodgateApi.class, javaOffline));
        assertNull(IdentityChecks.isFloodgatePlayer(String.class, javaOffline));
    }
}
