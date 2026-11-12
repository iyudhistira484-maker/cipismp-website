import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/server/logger";
import { acknowledgePluginDelivery } from "@/server/delivery/polling";
import { verifyAndConsumePluginRequest } from "@/server/delivery/plugin-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  deliveryId: z.string().min(4).max(100),
  leaseToken: z.string().uuid(),
  attempt: z.number().int().min(1).max(100_000),
  ok: z.boolean(),
  applied: z.number().int().min(0).max(10_000),
  queuedOffline: z.boolean(),
  error: z.string().max(1000).optional(),
  durationMs: z.number().int().min(0).max(180_000),
});

/** Signed ACK after the companion plugin has executed or durably queued a delivery. */
export async function POST(request: Request) {
  const verified = await verifyAndConsumePluginRequest(request);
  if (!verified.ok) {
    logger.warn("plugin_ack_rejected", { reason: verified.message });
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
    return NextResponse.json({ ok: false, message: "Payload ACK tidak valid" }, { status: 400 });
  }

  try {
    const result = await acknowledgePluginDelivery(parsed.data);
    if (!result.accepted) {
      return NextResponse.json({ ok: false, message: result.message }, { status: 409 });
    }
    return NextResponse.json({ ok: true, duplicate: result.duplicate ?? false, status: result.status });
  } catch (error) {
    logger.error("plugin_ack_failed", { deliveryId: parsed.data.deliveryId, error: (error as Error).message });
    return NextResponse.json({ ok: false, message: "Gagal mencatat hasil pengiriman" }, { status: 503 });
  }
}
