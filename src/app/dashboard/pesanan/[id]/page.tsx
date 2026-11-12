import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Download, ExternalLink } from "lucide-react";
import { requireCustomer } from "@/server/auth/guard";
import { getOrderDetail } from "@/server/orders";
import { ORDER_STATUS_LABEL, DELIVERY_STATUS_LABEL, type OrderStatus } from "@/lib/order-state";
import { formatDateTimeWIB } from "@/lib/dates";
import { formatRp } from "@/lib/money";
import { activeUntilLabel } from "@/lib/seasons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSettings } from "@/server/settings";
import { orderTrackingMessage, deliveryTrackingMessage } from "@/lib/order-tracking";

export const metadata: Metadata = { title: "Detail pesanan", robots: { index: false, follow: false } };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireCustomer("/dashboard/pesanan");
  const { id } = await params;
  const detail = await getOrderDetail(id);
  if (!detail || detail.order.userId !== viewer.user.id) notFound();
  const { order, items, deliveries, payments, season } = detail;
  const settings = await getSettings();
  const tracking = orderTrackingMessage(order.status, payments[0]?.status);
  const supportLink = `mailto:${settings.site.supportEmail}?subject=${encodeURIComponent(`Bantuan pesanan ${order.orderNumber}`)}`;

  return (
    <div>
      <Link href="/dashboard/pesanan" className="text-[12.5px] text-muted hover:text-accent">
        ← Semua pesanan
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Pesanan</p>
          <h1 className="mt-2 font-display text-h2 text-ink">{order.orderNumber}</h1>
          <p className="mt-1 text-2xs text-muted-2">
            {formatDateTimeWIB(order.createdAt)} WIB · {order.mcName} · {season?.name}
          </p>
        </div>
        <Badge tone={order.status === "DELIVERED" ? "success" : order.status === "PENDING" ? "accent" : "warning"}>
          {ORDER_STATUS_LABEL[order.status as OrderStatus]}
        </Badge>
      </div>

      <section aria-labelledby="tracking-title" className="mt-6 rounded-xl border border-line bg-white p-5 shadow-card">
        <p className="eyebrow">Pelacakan pesanan</p>
        <h2 id="tracking-title" className="mt-2 font-display text-lg text-ink">{tracking.title}</h2>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">{tracking.body}</p>
        <dl className="mt-4 grid gap-3 border-t border-line pt-4 text-[12px] sm:grid-cols-3">
          <div><dt className="text-muted-2">Pembayaran</dt><dd className="mt-1 font-medium text-ink">{order.paidAt ? `Terkonfirmasi ${formatDateTimeWIB(order.paidAt)} WIB` : payments[0]?.status === "UNDERPAID" ? "Nominal kurang — perlu pemeriksaan" : "Belum terkonfirmasi"}</dd></div>
          <div><dt className="text-muted-2">Batas pembayaran</dt><dd className="mt-1 text-ink">{formatDateTimeWIB(order.expiresAt)} WIB</dd></div>
          <div><dt className="text-muted-2">Pengiriman</dt><dd className="mt-1 text-ink">{deliveries.length ? `${deliveries.filter((delivery) => delivery.status === "DELIVERED").length} dari ${deliveries.length} tercatat selesai` : "Belum ada data pengiriman"}</dd></div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[12px] font-semibold">
          {order.status === "PENDING" && payments[0]?.status !== "UNDERPAID" ? <a href={`/pesanan/${order.publicToken}`} className="text-accent-strong hover:underline">Lanjutkan pembayaran →</a> : null}
          <Link href={`/dashboard/bantuan?order=${encodeURIComponent(id)}`} className="text-accent-strong hover:underline">Minta bantuan{tracking.needsHelp ? " tentang pesanan ini" : ""} →</Link>
          <a href={supportLink} className="text-accent-strong hover:underline">Email bantuan →</a>
        </div>
        <p className="mt-3 text-[11px] text-muted-2">Tampilan ini menggunakan catatan toko, bukan pemeriksaan langsung inventaris di game.</p>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="divide-y divide-line rounded-lg border border-line">
          {items.map((item) => {
            const delivery = deliveries.find((d) => d.orderItemId === item.id);
            return (
              <div key={item.id} className="flex items-start justify-between gap-3 p-4">
                <div>
                  <p className="text-[14px] text-ink">{item.nameSnapshot}</p>
                  <p className="mt-0.5 text-2xs text muted-2 text-muted-2">
                    {item.type === "RANK" ? "Rank" : "Kit"} · {item.targetName}
                    {item.meta?.upgradeFromName ? ` · upgrade dari ${item.meta.upgradeFromName}` : ""}
                  </p>
                  {delivery ? (
                    <p className="mt-1 text-2xs text-muted-2">
                      Pengiriman: {DELIVERY_STATUS_LABEL[delivery.status] ?? "Belum tersedia"}
                      {delivery.deliveredAt ? ` (${formatDateTimeWIB(delivery.deliveredAt)} WIB)` : ""}<br />
                      {deliveryTrackingMessage(delivery.status)}
                    </p>
                  ) : null}
                </div>
                <p className="text-[13.5px] text-ink">{formatRp(item.lineTotalIdr)}</p>
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-surface/60 p-4">
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="text-ink">{formatRp(order.subtotalIdr)}</dd></div>
              {order.discountIdr > 0 ? (
                <div className="flex justify-between text-success">
                  <dt>
                    Diskon {order.couponCode
                      ? `(${order.couponCode})`
                      : order.discountLabel
                        ? `(otomatis: ${order.discountLabel})`
                        : ""}
                  </dt>
                  <dd>−{formatRp(order.discountIdr)}</dd>
                </div>
              ) : null}
              {order.taxIdr > 0 ? <div className="flex justify-between"><dt className="text-muted">Pajak</dt><dd className="text-ink">{formatRp(order.taxIdr)}</dd></div> : null}
              <div className="flex justify-between border-t border-line pt-2 text-[15px]"><dt className="text-ink">Total</dt><dd className="text-ink">{formatRp(order.totalIdr)}</dd></div>
            </dl>
            <p className="mt-2 text-2xs text-muted-2">Gateway: {payments[0]?.provider ?? "—"} · {payments[0]?.status ?? "—"}</p>
            {season ? <p className="mt-2 text-2xs text-muted-2">{activeUntilLabel(season)}</p> : null}

            <div className="mt-4 flex flex-col gap-2">
              <a href={`/pesanan/${order.publicToken}/invoice`} target="_blank" rel="noreferrer">
                <Button variant="secondary" className="w-full">
                  <Download className="size-4" aria-hidden />
                  Kuitansi PDF
                </Button>
              </a>
              <a href={`/pesanan/${order.publicToken}`} target="_blank" rel="noreferrer">
                <Button variant="ghost" className="w-full">
                  <ExternalLink className="size-4" aria-hidden />
                  Halaman status publik
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
