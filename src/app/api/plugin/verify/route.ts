import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { authTokens, minecraftProfiles } from "@/server/db/schema";
import { verifyAndConsumePluginRequest } from "@/server/delivery/plugin-request";
import { sha256 } from "@/server/crypto";
import { upsertProfile } from "@/server/minecraft";
import { logger } from "@/server/logger";
import { writeAudit } from "@/server/audit";

export const dynamic = "force-dynamic";

/**
 * Dipanggil plugin saat pemain mengetik /verify <kode> di server.
 * Request ditandatangani HMAC (timestamp + nonce + body) dan nonce tidak boleh
 * dipakai ulang, sehingga endpoint ini tidak bisa dipalsukan dari luar.
 */
export async function POST(request: Request) {
  const verified = await verifyAndConsumePluginRequest(request);
  if (!verified.ok) {
    logger.warn("plugin_verify_rejected", { reason: verified.message });
    return NextResponse.json({ ok: false, message: verified.message }, { status: verified.status });
  }

  let payload: { code?: string; uuid?: string; player?: string };
  try {
    payload = JSON.parse(verified.body) as typeof payload;
  } catch {
    return NextResponse.json({ ok: false, message: "JSON tidak valid" }, { status: 400 });
  }
  const code = (payload.code ?? "").trim().toUpperCase();
  if (!code) return NextResponse.json({ ok: false, message: "Kode kosong" }, { status: 400 });

  const token = await db.query.authTokens.findFirst({
    where: and(eq(authTokens.tokenHash, sha256(code)), eq(authTokens.type, "MC_VERIFY")),
  });
  if (!token || token.usedAt || token.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ ok: false, message: "Kode tidak valid atau kedaluwarsa" }, { status: 404 });
  }

  const tokenPayload = (token.payload ?? {}) as { uuid?: string; playerName?: string; edition?: "JAVA" | "BEDROCK" };
  if (tokenPayload.uuid && payload.uuid && tokenPayload.uuid !== payload.uuid) {
    return NextResponse.json({ ok: false, message: "Kode ini bukan untuk akun tersebut" }, { status: 409 });
  }

  const uuid = payload.uuid ?? tokenPayload.uuid;
  const playerName = payload.player ?? tokenPayload.playerName;
  if (!uuid || !playerName) return NextResponse.json({ ok: false, message: "Data pemain tidak lengkap" }, { status: 400 });

  await db.transaction(async (tx) => {
    await tx.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, token.id));
    const existing = await tx.query.minecraftProfiles.findFirst({ where: eq(minecraftProfiles.uuid, uuid) });
    if (existing) {
      await tx
        .update(minecraftProfiles)
        .set({
          userId: token.userId,
          displayName: playerName,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(minecraftProfiles.uuid, uuid));
    }
  });

  await upsertProfile({
    uuid,
    name: playerName,
    edition: tokenPayload.edition ?? "JAVA",
    userId: token.userId,
    verified: true,
  });

  await writeAudit({
    actor: { id: token.userId, label: `plugin:${playerName}` },
    action: "minecraft.verified",
    targetType: "minecraft_profile",
    targetId: uuid,
    after: { playerName, uuid },
  });

  logger.info("minecraft_verified", { uuid, playerName, userId: token.userId });
  return NextResponse.json({ ok: true, message: "Akun berhasil dihubungkan" });
}
