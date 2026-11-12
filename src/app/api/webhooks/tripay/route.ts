import { NextResponse } from "next/server";
import { handleProviderWebhook } from "@/server/payments/webhook";
import { clientIp } from "@/server/csrf";
import { logger } from "@/server/logger";
import { rateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  const limit = await rateLimit(`webhook:tripay:${ip}`, 120, 60);
  if (!limit.allowed) return NextResponse.json({ success: false }, { status: 429 });

  const rawBody = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  try {
    const outcome = await handleProviderWebhook("TRIPAY", rawBody, headers, ip);
    logger.info("webhook_tripay", { result: outcome.result, duplicate: outcome.duplicate });
    return NextResponse.json({ success: outcome.httpStatus === 200 }, { status: outcome.httpStatus });
  } catch (error) {
    logger.error("webhook_tripay_error", { error: (error as Error).message });
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
