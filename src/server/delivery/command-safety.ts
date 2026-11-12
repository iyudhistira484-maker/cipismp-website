// A deliberately small allowlist for the current CipiSMP catalog. Custom console
// commands are not safe to execute with server privileges without review.
const RANK = /^lp user (\S+) parent (?:add|remove) (?:vip|mvp|elite|legend)$/i;
const KIT_SET = /^lp user (\S+) permission set playerkits\.kits\.(?:cipiprime|cipi\+\+) true$/i;
const KIT_UNSET = /^lp user (\S+) permission unset playerkits\.kits\.(?:cipiprime|cipi\+\+)$/i;

export function deliveryCommandsAreSafe(commands: string[], player: string, uuid: string): boolean {
  if (!commands.length || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) return false;
  return commands.every((command) => {
    // Do not normalize whitespace: accepting newlines or hidden control characters
    // can change how a console interprets the command.
    const match = RANK.exec(command) ?? KIT_SET.exec(command) ?? KIT_UNSET.exec(command);
    if (!match) return false;
    const target = match[1]!.toLowerCase();
    return target === uuid.toLowerCase() || (target === player.toLowerCase() && /^[A-Za-z0-9_.]{3,16}$/.test(player));
  });
}

export function containsRankChange(commands: string[]): boolean {
  return commands.some((command) => /^lp user \S+ parent (?:add|remove) (?:vip|mvp|elite|legend)$/i.test(command));
}

export function containsRankGrant(commands: string[]): boolean {
  return commands.some((command) => /^lp user \S+ parent add (?:vip|mvp|elite|legend)$/i.test(command));
}

export const UNSAFE_DELIVERY_MESSAGE = "Perintah pengiriman tidak sesuai daftar aman atau target tidak cocok; rekonsiliasi manual diperlukan.";
export const STAFF_RANK_DELIVERY_MESSAGE = "Rank ditahan karena pembeli atau penerima diketahui sebagai staf; rekonsiliasi pembayaran diperlukan.";
