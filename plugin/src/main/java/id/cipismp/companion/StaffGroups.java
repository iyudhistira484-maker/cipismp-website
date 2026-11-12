package id.cipismp.companion;

import java.util.Locale;
import java.util.Set;

/** Staff group names confirmed by the owner; keep in sync with the server. */
final class StaffGroups {
    private static final Set<String> NAMES = Set.of("owner", "co-owner", "manager", "sr-admin", "admin", "sr-moderator", "moderator", "helper", "trainee");
    private StaffGroups() {}
    static boolean contains(String name) {
        return name != null && NAMES.contains(name.toLowerCase(Locale.ROOT));
    }
}
