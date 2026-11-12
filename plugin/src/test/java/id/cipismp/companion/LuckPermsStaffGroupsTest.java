package id.cipismp.companion;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class LuckPermsStaffGroupsTest {
    @Test void protectsEveryConfirmedStaffGroupCaseInsensitively() {
        for (String name : List.of("owner", "co-owner", "manager", "sr-admin", "admin", "sr-moderator", "moderator", "helper", "trainee")) {
            assertTrue(StaffGroups.contains(name), name);
            assertTrue(StaffGroups.contains(name.toUpperCase(java.util.Locale.ROOT)), name);
        }
        for (String name : List.of("default", "freerank", "vip", "mvp", "elite", "legend")) assertFalse(StaffGroups.contains(name), name);
        assertFalse(StaffGroups.contains(null));
    }
}
