import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Download, ExternalLink } from "lucide-react";
import { requireViewer } from "@/server/auth/guard";
import { getOrderDetail } from "@/server/orders";
import { ORDER_STATUS_LABEL, DELIVERY_STATUS_LABEL, type OrderStatus } from "@/lib/order-state";
import { formatDateTimeWIB } from "@/lib/dates";
import { formatRp } from "@/lib/money";
import { activeUntilLabel } from "@/lib/seasons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Detail pesanan", robots: { index: false, follow: false } };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireViewer("/dashboard/pesanan");
  const { id } = await params;
  const detail = await getOrderDetail(id);
  if (!detail || detail.order.userId !== viewer.user.id) notFound();
  const { order, items, deliveries, payments, season } = detail;

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

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
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
                      Pengiriman: {DELIVERY_STATUS_LABEL[delivery.status] ?? delivery.status}
                      {delivery.deliveredAt ? ` (${formatDateTimeWIB(delivery.deliveredAt)} WIB)` : ""}
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
              {order.discountIdr > 0 ? <div className="flex justify-between text-success"><dt>Diskon</dt><dd>−{formatRp(order.discountIdr)}</dd></div> : null}
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
