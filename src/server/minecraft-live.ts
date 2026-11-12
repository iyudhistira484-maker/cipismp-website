import { and, eq, gt, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { minecraftLiveSnapshots, minecraftProfiles } from "./db/schema";

// Observations are deliberately short-lived; this is not a log of player activity.
export const LIVE_MAX_AGE_MS = 90_000;
export const LIVE_MAX_CLOCK_SKEW_MS = 60_000;
const safeText = (max: number) => z.string().trim().min(1).max(max).refine((s) => !/[\u0000-\u001f\u007f]/.test(s));
export const livePayloadSchema = z.object({
  observedAt: z.number().int().safe().positive(),
  players: z.array(z.object({
    uuid: z.string().uuid().transform((s) => s.toLowerCase()),
    primaryGroup: safeText(64).nullable(),
    kits: z.array(z.object({ name: safeText(64), cooldown: safeText(160).nullable() }).strict()).max(5),
  }).strict()).max(50),
}).strict().superRefine((payload, ctx) => {
  if (new Set(payload.players.map((p) => p.uuid)).size !== payload.players.length) ctx.addIssue({ code: "custom", message: "UUID duplikat" });
  for (const player of payload.players) if (new Set(player.kits.map((kit) => kit.name.toLowerCase())).size !== player.kits.length) ctx.addIssue({ code: "custom", message: "Nama kit duplikat" });
});
export type LivePayload = z.infer<typeof livePayloadSchema>;

/** Store only verified, owned profiles; serialize with unlink/reverification and ignore older batches. */
export async function saveLiveSnapshots(input: LivePayload, now = new Date()) {
  const observedAt = new Date(input.observedAt);
  if (Math.abs(now.getTime() - input.observedAt) > LIVE_MAX_CLOCK_SKEW_MS) throw new Error("Waktu snapshot tidak valid");
  if (!input.players.length) return 0;
  return db.transaction(async (tx) => {
    const profiles = await tx.select({ id: minecraftProfiles.id, uuid: minecraftProfiles.uuid, verifiedAt: minecraftProfiles.verifiedAt }).from(minecraftProfiles)
      .where(and(inArray(sql<string>`lower(${minecraftProfiles.uuid})`, input.players.map((p) => p.uuid)), isNotNull(minecraftProfiles.verifiedAt), isNotNull(minecraftProfiles.userId)))
      .orderBy(minecraftProfiles.id).for("update");
    let saved = 0;
    const byUuid = new Map(input.players.map((player) => [player.uuid, player]));
    for (const profile of profiles) {
      const player = byUuid.get(profile.uuid.toLowerCase());
      if (!player || !profile.verifiedAt || profile.verifiedAt.getTime() > observedAt.getTime()) continue;
      const rows = await tx.insert(minecraftLiveSnapshots).values({ profileId: profile.id, observedAt, primaryGroup: player.primaryGroup, kits: player.kits })
        .onConflictDoUpdate({ target: minecraftLiveSnapshots.profileId, set: { observedAt, primaryGroup: player.primaryGroup, kits: player.kits }, setWhere: sql`${minecraftLiveSnapshots.observedAt} < ${observedAt}` }).returning({ id: minecraftLiveSnapshots.profileId });
      saved += rows.length;
    }
    return saved;
  });
}

/** Snapshot rows never cross account ownership or survive a new verification. */
export async function liveSnapshotsForUser(userId: string, now = new Date()) {
  return db.select({ profileId: minecraftProfiles.id, playerName: minecraftProfiles.displayName, observedAt: minecraftLiveSnapshots.observedAt, primaryGroup: minecraftLiveSnapshots.primaryGroup, kits: minecraftLiveSnapshots.kits })
    .from(minecraftProfiles).innerJoin(minecraftLiveSnapshots, eq(minecraftLiveSnapshots.profileId, minecraftProfiles.id))
    .where(and(eq(minecraftProfiles.userId, userId), isNotNull(minecraftProfiles.verifiedAt), gt(minecraftLiveSnapshots.observedAt, minecraftProfiles.verifiedAt), gt(minecraftLiveSnapshots.observedAt, new Date(now.getTime() - LIVE_MAX_AGE_MS)), sql`${minecraftLiveSnapshots.observedAt} <= ${now}`));
}
