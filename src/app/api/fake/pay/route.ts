import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { orders, payments } from "@/server/db/schema";
import { env } from "@/server/env";
import { FakeAdapter } from "@/server/payments/fake";
import { handleProviderWebhook } from "@/server/payments/webhook";

export const dynamic = "force-dynamic";

/**
 * Mensimulasikan notifikasi gateway. Body webhook ditandatangani dengan secret
 * yang sama seperti adapter asli, lalu diproses lewat jalur verifikasi normal.
 */
export async function POST(request: Request) {
  if (env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  const json = (await request.json().catch(() => null)) as { reference?: string; status?: string } | null;
  if (!json?.reference) return NextResponse.json({ ok: false, message: "Reference wajib" }, { status: 400 });

  const payment = await db.query.payments.findFirst({ where: eq(payments.providerRef, json.reference) });
  if (!payment) return NextResponse.json({ ok: false, message: "Pembayaran tidak ditemukan" }, { status: 404 });
  const order = await db.query.orders.findFirst({ where: eq(orders.id, payment.orderId) });
  if (!order) return NextResponse.json({ ok: false }, { status: 404 });

  const status = json.status === "EXPIRED" || json.status === "FAILED" ? json.status : "PAID";
  const adapter = new FakeAdapter(env.SESSION_SECRET);
  const { body, signature } = await adapter.buildWebhookBody({
    reference: payment.providerRef,
    merchantRef: order.orderNumber,
    amount: order.totalIdr,
    status,
  });

  const outcome = await handleProviderWebhook("FAKE", body, { "x-fake-signature": signature }, "fake-gateway");
  return NextResponse.json({ ok: outcome.httpStatus === 200, result: outcome.result, statusUrl: `/pesanan/${order.publicToken}` });
}
