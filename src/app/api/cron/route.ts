import { NextResponse } from "next/server";
import { env } from "@/server/env";
import { createTickState, runWorkerTick } from "@/server/jobs/runner";
import { logger } from "@/server/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Pemicu siklus worker untuk deployment tanpa proses worker terpisah
 * (mis. cron Cloudflare / systemd timer). Wajib menyertakan CRON_SECRET.
 */
export async function POST(request: Request) {
  const secret = env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, message: "CRON_SECRET belum diatur" }, { status: 503 });
  }
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const result = await runWorkerTick(createTickState());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logger.error("cron_tick_failed", { error: (error as Error).message });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
