import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { paymentHealth } from "@/server/payments/webhook";

export const dynamic = "force-dynamic";

/** Health check untuk load balancer & monitoring. Tidak membocorkan detail internal. */
export async function GET() {
  const started = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    const payments = await paymentHealth();
    return NextResponse.json(
      {
        status: "ok",
        db: "up",
        latencyMs: Date.now() - started,
        pendingPayments: payments.pending,
        staleEvents: payments.staleEvents,
        version: process.env.APP_VERSION ?? "dev",
        time: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ status: "degraded", db: "down" }, { status: 503 });
  }
}
