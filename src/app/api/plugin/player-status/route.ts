import { NextResponse } from "next/server";
import { verifyAndConsumePluginRequest } from "@/server/delivery/plugin-request";
import { LIVE_MAX_CLOCK_SKEW_MS, livePayloadSchema, saveLiveSnapshots } from "@/server/minecraft-live";
import { logger } from "@/server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Signed companion snapshots, never public data or a source of store entitlements. */
export async function POST(request: Request) {
  const verified = await verifyAndConsumePluginRequest(request);
  if (!verified.ok) return NextResponse.json({ ok: false, message: verified.message }, { status: verified.status });
  let value: unknown;
  try { value = JSON.parse(verified.body); } catch { return NextResponse.json({ ok: false, message: "JSON tidak valid" }, { status: 400 }); }
  const parsed = livePayloadSchema.safeParse(value);
  if (!parsed.success || Math.abs(Date.now() - parsed.data.observedAt) > LIVE_MAX_CLOCK_SKEW_MS) return NextResponse.json({ ok: false, message: "Snapshot tidak valid atau waktu server tidak sesuai" }, { status: 400 });
  try {
    // Do not return account matching information to the plugin.
    await saveLiveSnapshots(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("minecraft_live_snapshot_failed", { error: (error as Error).message });
    return NextResponse.json({ ok: false, message: "Snapshot belum dapat disimpan" }, { status: 503 });
  }
}
