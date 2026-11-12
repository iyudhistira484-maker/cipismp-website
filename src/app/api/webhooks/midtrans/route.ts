import { NextResponse } from "next/server";
import { handleProviderWebhook } from "@/server/payments/webhook";
import { clientIp } from "@/server/csrf";
import { logger } from "@/server/logger";
import { rateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  const limit = await rateLimit(`webhook:midtrans:${ip}`, 120, 60);
  if (!limit.allowed) return NextResponse.json({ ok: false }, { status: 429 });

  const rawBody = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  try {
    const outcome = await handleProviderWebhook("MIDTRANS", rawBody, headers, ip);
    logger.info("webhook_midtrans", { result: outcome.result, duplicate: outcome.duplicate });
    return NextResponse.json({ ok: outcome.httpStatus === 200 }, { status: outcome.httpStatus });
  } catch (error) {
    logger.error("webhook_midtrans_error", { error: (error as Error).message });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
