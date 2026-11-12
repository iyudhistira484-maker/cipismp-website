import { simulationAllowed } from "@/lib/environment-policy";
import { NextResponse } from "next/server";
import { handleProviderWebhook } from "@/server/payments/webhook";
import { clientIp } from "@/server/csrf";
import { logger } from "@/server/logger";

export const dynamic = "force-dynamic";

/** Hanya tersedia di non-produksi: dipakai halaman pembayaran simulasi. */
export async function POST(request: Request) {
  if (!simulationAllowed(process.env.NODE_ENV, process.env.APP_ENV)) {
    return NextResponse.json({ ok: false, message: "Tidak tersedia di produksi" }, { status: 404 });
  }
  const rawBody = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  try {
    const outcome = await handleProviderWebhook("FAKE", rawBody, headers, clientIp(request.headers));
    logger.info("webhook_fake", { result: outcome.result });
    return NextResponse.json({ ok: outcome.httpStatus === 200, result: outcome.result }, { status: outcome.httpStatus });
  } catch (error) {
    logger.error("webhook_fake_error", { error: (error as Error).message });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
