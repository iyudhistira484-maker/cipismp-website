import type { servers } from "../db/schema";

/** A recent signed protocol-v2 check-in is necessary, not proof of live correctness. */
export function offlinePluginReady(server: typeof servers.$inferSelect | null | undefined, now = Date.now()): boolean {
  if (!server || server.deliveryMode !== "PLUGIN" || server.pluginIdentityProtocol !== 2 || server.pluginAuthReady !== true || !server.pluginLastSeenAt) return false;
  const age = now - server.pluginLastSeenAt.getTime();
  return age >= -10_000 && age <= 120_000;
}
