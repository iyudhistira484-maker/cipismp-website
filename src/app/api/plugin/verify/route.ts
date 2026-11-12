import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAndConsumePluginRequest } from "@/server/delivery/plugin-request";
import { consumeMinecraftVerification } from "@/server/auth/minecraft-verification";
import { logger } from "@/server/logger";
import { writeAudit } from "@/server/audit";

export const dynamic = "force-dynamic";

const payloadSchema = z.object({ code: z.string().max(64), uuid: z.string().max(64), player: z.string().max(32) });

/** Only the authenticated companion may supply the player's in-game identity. */
export async function POST(request: Request) {
  const verified = await verifyAndConsumePluginRequest(request);
  if (!verified.ok) {
    logger.warn("plugin_verify_rejected", { reason: verified.message });
    return NextResponse.json({ ok: false, message: verified.message }, { status: verified.status });
  }
  let body: unknown;
  try { body = JSON.parse(verified.body); } catch {
    return NextResponse.json({ ok: false, message: "JSON tidak valid" }, { status: 400 });
  }
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Data pemain tidak lengkap" }, { status: 400 });
  const result = await consumeMinecraftVerification(parsed.data);
  if (!result.ok) return NextResponse.json({ ok: false, message: result.message }, { status: result.status });

  await writeAudit({
    actor: { id: result.userId, label: `plugin:${result.playerName}` },
    action: "minecraft.verified", targetType: "minecraft_profile", targetId: result.uuid,
    after: { playerName: result.playerName, uuid: result.uuid },
  });
  logger.info("minecraft_verified", { uuid: result.uuid, playerName: result.playerName, userId: result.userId });
  return NextResponse.json({ ok: true, message: "Akun berhasil dihubungkan" });
}
