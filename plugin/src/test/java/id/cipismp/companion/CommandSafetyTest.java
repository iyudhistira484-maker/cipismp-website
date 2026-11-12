package id.cipismp.companion;

import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class CommandSafetyTest {
    private static final UUID UUID_VALUE = UUID.fromString("33333333-3333-4333-8333-333333333333");
    @Test void allowsOnlyKnownCatalogCommandsForTheRecipient() {
        assertTrue(CommandSafety.allowed(List.of("lp user Player parent add vip", "lp user Player parent remove mvp"), "Player", UUID_VALUE));
        assertTrue(CommandSafety.allowed(List.of("lp user " + UUID_VALUE + " permission set playerkits.kits.cipi++ true"), "Player", UUID_VALUE));
        for (String bad : List.of("lp user Player parent set vip", "lp user Player parent set default", "lp user Player parent add freerank", "lp user Player parent remove freerank", "lp user Player parent remove admin", "lp user Other parent add vip", "op Player", "lp user Player parent add vip\nop Player", "lp user Player permission set * true")) {
            assertFalse(CommandSafety.allowed(List.of(bad), "Player", UUID_VALUE), bad);
        }
        assertFalse(CommandSafety.allowed(List.of(), "Player", UUID_VALUE));
    }
}
