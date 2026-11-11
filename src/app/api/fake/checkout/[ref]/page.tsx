import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { orders, payments } from "@/server/db/schema";
import { FakeCheckoutPanel } from "@/components/store/fake-checkout-panel";
import { formatRp } from "@/lib/money";

export const dynamic = "force-dynamic";

/**
 * Halaman pembayaran SIMULASI (hanya non-produksi). Memungkinkan pengujian alur
 * lengkap — termasuk webhook bertanda tangan — tanpa kredensial gateway asli.
 */
export default async function FakeCheckoutPage({ params }: { params: Promise<{ ref: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { ref } = await params;
  const payment = await db.query.payments.findFirst({ where: eq(payments.providerRef, decodeURIComponent(ref)) });
  if (!payment) notFound();
  const order = await db.query.orders.findFirst({ where: eq(orders.id, payment.orderId) });
  if (!order) notFound();

  return (
    <div className="container-page flex min-h-dvh items-center justify-center py-16">
      <div className="w-full max-w-md">
        <p className="eyebrow">Pembayaran simulasi</p>
        <h1 className="mt-2 font-display text-h2 text-ink">Gateway palsu</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          Halaman ini hanya muncul di lingkungan non-produksi. Menekan tombol di bawah akan mengirim
          webhook bertanda tangan seperti gateway sungguhan.
        </p>
        <dl className="mt-6 space-y-2 rounded-lg border border-line bg-surface p-4 text-[13px]">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Order</dt>
            <dd className="font-pixel text-[11px] text-ink">{order.orderNumber}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Total</dt>
            <dd className="text-ink">{formatRp(order.totalIdr)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Metode</dt>
            <dd className="text-ink">{payment.method ?? "QRIS"}</dd>
          </div>
        </dl>
        <FakeCheckoutPanel reference={payment.providerRef} orderNumber={order.orderNumber} statusUrl={`/pesanan/${order.publicToken}`} />
      </div>
    </div>
  );
}
