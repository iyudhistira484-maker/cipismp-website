import { and, eq, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { authTokens, minecraftProfiles } from "@/server/db/schema";
import { ids } from "@/server/ids";
import { sha256 } from "@/server/crypto";
import { env } from "@/server/env";

export type MinecraftVerificationResult =
  | { ok: true; userId: string; uuid: string; playerName: string }
  | { ok: false; status: number; message: string };

/** Only trusted signed plugin requests may supply the in-game UUID and player name. */
export async function consumeMinecraftVerification(input: { code: string; uuid: string; player: string; edition?: "JAVA" | "BEDROCK"; identityVersion?: 2 }): Promise<MinecraftVerificationResult> {
  const code = input.code.trim().toUpperCase();
  const uuid = input.uuid.trim().toLowerCase();
  const playerName = input.player.trim();
  if (!/^[A-Z2-9]{6}$/.test(code) || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(uuid) || !playerName || playerName.length > 32) {
    return { ok: false, status: 400, message: "Data verifikasi tidak valid" };
  }

  return db.transaction(async (tx): Promise<MinecraftVerificationResult> => {
    const [token] = await tx.select().from(authTokens).where(and(eq(authTokens.tokenHash, sha256(code)), eq(authTokens.type, "MC_VERIFY"))).limit(1).for("update");
    if (!token || !token.userId || token.usedAt || token.expiresAt.getTime() <= Date.now()) {
      return { ok: false, status: 404, message: "Kode tidak valid atau kedaluwarsa" };
    }
    const payload = (token.payload ?? {}) as { uuid?: string; playerName?: string; edition?: "JAVA" | "BEDROCK"; identityMode?: string };
    if (!payload.playerName || !payload.uuid || (payload.edition !== "JAVA" && payload.edition !== "BEDROCK")) {
      return { ok: false, status: 400, message: "Data kode tidak lengkap" };
    }
    // Pending codes created for the retired Floodgate prefix must not relink it.
    if (payload.edition === "BEDROCK" && !payload.playerName.startsWith("_")) {
      return { ok: false, status: 409, message: "Prefiks Bedrock telah berubah. Buat kode baru dengan nama server berawalan _." };
    }
    const offline = env.MINECRAFT_LOOKUP_MODE === "offline";
    if (offline && (payload.identityMode !== "offline" || input.identityVersion !== 2 || !input.edition)) {
      return { ok: false, status: 409, message: "Kode atau plugin perlu diperbarui untuk server offline. Buat kode baru setelah plugin diperbarui." };
    }
    if (input.identityVersion === 2 && input.edition !== payload.edition) {
      return { ok: false, status: 409, message: "Edisi pemain tidak sesuai dengan kode." };
    }
    // Offline Java and Bedrock are bound to the submitted name; the signed,
    // authenticated v2 plugin reports the server's actual UUID. Online Java
    // remains bound to the Mojang UUID as before.
    const mustMatchName = offline || payload.edition === "BEDROCK";
    if (mustMatchName ? payload.playerName.toLowerCase() !== playerName.toLowerCase() : payload.uuid.toLowerCase() !== uuid) {
      return { ok: false, status: 409, message: "Kode ini bukan untuk akun tersebut" };
    }

    // Serialize competing claims by UUID and normalized player name.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`mc-name:${playerName.toLowerCase()}`}, 0))`);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`mc-uuid:${uuid}`}, 0))`);
    if (offline || payload.edition === "BEDROCK") {
      const conflicts = await tx.select({ uuid: minecraftProfiles.uuid }).from(minecraftProfiles).where(and(
        eq(minecraftProfiles.edition, payload.edition), eq(sql`lower(${minecraftProfiles.displayName})`, playerName.toLowerCase()),
        isNotNull(minecraftProfiles.verifiedAt), isNotNull(minecraftProfiles.userId),
      ));
      if (conflicts.some((profile) => profile.uuid.toLowerCase() !== uuid)) {
        return { ok: false, status: 409, message: "Nama Minecraft sudah terhubung ke UUID lain. Hubungi bantuan." };
      }
    }
    const now = new Date();
    const rows = await tx.insert(minecraftProfiles).values({
      id: ids.minecraft(), uuid, edition: payload.edition, displayName: playerName,
      userId: token.userId, verifiedAt: now, identityVerifiedVersion: offline ? 2 : null, lastSyncedAt: now,
    }).onConflictDoUpdate({
      target: minecraftProfiles.uuid,
      set: { edition: payload.edition, displayName: playerName, userId: token.userId, verifiedAt: now, identityVerifiedVersion: offline ? 2 : null, lastSyncedAt: now, updatedAt: now },
      setWhere: or(sql`${minecraftProfiles.verifiedAt} IS NULL`, sql`${minecraftProfiles.userId} IS NULL`, eq(minecraftProfiles.userId, token.userId)),
    }).returning({ id: minecraftProfiles.id });
    if (!rows.length) return { ok: false, status: 409, message: "Akun Minecraft sudah terhubung ke akun lain" };
    await tx.update(authTokens).set({ usedAt: now }).where(eq(authTokens.id, token.id));
    return { ok: true, userId: token.userId, uuid, playerName };
  });
}
