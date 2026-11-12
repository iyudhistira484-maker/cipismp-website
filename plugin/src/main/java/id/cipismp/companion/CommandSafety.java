package id.cipismp.companion;

import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Reject legacy queues and custom commands outside the current catalog allowlist. */
public final class CommandSafety {
    private static final int FLAGS = Pattern.CASE_INSENSITIVE;
    private static final Pattern RANK = Pattern.compile("lp user (\\S+) parent (?:add|remove) (?:vip|mvp|elite|legend)", FLAGS);
    private static final Pattern KIT_SET = Pattern.compile("lp user (\\S+) permission set playerkits\\.kits\\.(?:cipiprime|cipi\\+\\+) true", FLAGS);
    private static final Pattern KIT_UNSET = Pattern.compile("lp user (\\S+) permission unset playerkits\\.kits\\.(?:cipiprime|cipi\\+\\+)", FLAGS);
    private static final Pattern PLAYER = Pattern.compile("[A-Za-z0-9_.]{3,16}");

    private CommandSafety() {}

    public static boolean allowed(List<String> commands, String player, UUID uuid) {
        if (commands == null || commands.isEmpty() || player == null || uuid == null) return false;
        for (String command : commands) {
            if (command == null) return false;
            Matcher match = RANK.matcher(command);
            if (!match.matches()) { match = KIT_SET.matcher(command); if (!match.matches()) { match = KIT_UNSET.matcher(command); if (!match.matches()) return false; } }
            String target = match.group(1);
            if (!target.equalsIgnoreCase(uuid.toString()) && !(PLAYER.matcher(player).matches() && target.equalsIgnoreCase(player))) return false;
        }
        return true;
    }
}
