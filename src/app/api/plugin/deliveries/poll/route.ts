import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/server/logger";
import { pollPluginDeliveries } from "@/server/delivery/polling";
import { verifyAndConsumePluginRequest } from "@/server/delivery/plugin-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  version: z.string().max(64).optional().default("unknown"),
  limit: z.number().int().min(1).max(10).optional().default(5),
});

/** Companion-plugin initiated HTTPS poll; no inbound port on the Minecraft host is needed. */
export async function POST(request: Request) {
  const verified = await verifyAndConsumePluginRequest(request);
  if (!verified.ok) {
    logger.warn("plugin_poll_rejected", { reason: verified.message });
    return NextResponse.json({ ok: false, message: verified.message }, { status: verified.status });
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(verified.body);
  } catch {
    return NextResponse.json({ ok: false, message: "JSON tidak valid" }, { status: 400 });
  }
  const parsed = payloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Payload polling tidak valid" }, { status: 400 });
  }

  try {
    const result = await pollPluginDeliveries(parsed.data);
    return NextResponse.json({ ok: true, pollAfterSeconds: 10, ...result });
  } catch (error) {
    logger.error("plugin_poll_failed", { error: (error as Error).message });
    return NextResponse.json({ ok: false, message: "Gagal mengambil antrean pengiriman" }, { status: 503 });
  }
}
