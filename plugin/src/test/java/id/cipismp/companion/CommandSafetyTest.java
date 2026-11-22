package id.cipismp.companion;

import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class CommandSafetyTest {
    private static final UUID UUID_VALUE = UUID.fromString("33333333-3333-4333-8333-333333333333");
    @Test void allowsOnlyKnownCatalogCommandsForTheRecipient() {
        assertTrue(CommandSafety.allowed(List.of("lp user Player parent add vip", "lp user Player parent remove mvp"), "Player", UUID_VALUE));
        for (String kit : List.of("cipiprime", "cipi++")) {
            assertTrue(CommandSafety.allowed(List.of("lp user " + UUID_VALUE + " permission set essentials.kits." + kit + " true"), "Player", UUID_VALUE));
            assertTrue(CommandSafety.allowed(List.of("lp user " + UUID_VALUE + " permission unset essentials.kits." + kit), "Player", UUID_VALUE));
            assertTrue(CommandSafety.allowed(List.of("lp user .Bedrock permission set essentials.kits." + kit + " true"), ".Bedrock", UUID_VALUE));
        }
        for (String bad : List.of("lp user Player parent set vip", "lp user Player parent set default", "lp user Player parent add freerank", "lp user Player parent remove freerank", "lp user Player parent remove admin", "lp user Other parent add vip", "op Player", "lp user Player parent add vip\nop Player", "lp user Player permission set * true", "lp user Player permission set playerkits.kits.cipi++ true", "lp user Player permission unset playerkits.kits.cipiprime", "lp user Player permission set essentials.kits.* true", "lp user Player permission set essentials.kits.other true", "lp user Other permission set essentials.kits.cipi++ true", "lp user Player permission set essentials.kits.cipi++ false")) {
            assertFalse(CommandSafety.allowed(List.of(bad), "Player", UUID_VALUE), bad);
        }
        assertFalse(CommandSafety.allowed(List.of(), "Player", UUID_VALUE));
    }
}
