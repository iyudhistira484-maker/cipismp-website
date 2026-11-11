import Link from "next/link";
import type { Metadata } from "next";
import { requireViewer } from "@/server/auth/guard";
import { ordersForUser } from "@/server/orders";
import { getSeasonById } from "@/server/catalog";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/order-state";
import { formatDateTimeWIB } from "@/lib/dates";
import { formatRp } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Pesanan", robots: { index: false, follow: false } };

export default async function OrdersPage() {
  const viewer = await requireViewer("/dashboard/pesanan");
  const orders = await ordersForUser(viewer.user.id, 50);
  const seasons = new Map<string, string>();
  for (const order of orders) {
    if (!seasons.has(order.seasonId)) {
      const season = await getSeasonById(order.seasonId);
      seasons.set(order.seasonId, season?.name ?? "—");
    }
  }

  return (
    <div>
      <p className="eyebrow">Pesanan</p>
      <h1 className="mt-2 font-display text-h1 text-ink">Riwayat pembelian</h1>
      <p className="mt-2 text-[14px] text-muted">
        Kuitansi PDF tersedia untuk setiap pesanan. Status pengiriman tercatat per item.
      </p>

      {orders.length === 0 ? (
        <EmptyState
          className="mt-6"
          title="Belum ada pesanan"
          description="Setelah membeli rank atau kit, pesanan dan kuitansinya muncul di sini."
          action={<Link href="/rank" className="text-[13px] text-accent hover:underline">Lihat rank</Link>}
        />
      ) : (
        <div className="mt-6 space-y-2">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/dashboard/pesanan/${order.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface/60 p-4 transition-colors hover:border-line-strong"
            >
              <div>
                <p className="font-mono text-[11px] text-ink">{order.orderNumber}</p>
                <p className="mt-1 text-2xs text-muted-2">
                  {formatDateTimeWIB(order.createdAt)} WIB · {order.mcName} · {seasons.get(order.seasonId)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[13.5px] text-ink">{formatRp(order.totalIdr)}</span>
                <Badge tone={order.status === "DELIVERED" ? "success" : order.status === "PENDING" ? "accent" : "warning"}>
                  {ORDER_STATUS_LABEL[order.status as OrderStatus]}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
