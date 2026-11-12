import Link from "next/link";
import type { Metadata } from "next";
import { requireCustomer } from "@/server/auth/guard";
import { orderHistoryForUser } from "@/server/orders";
import { Pagination } from "@/components/dashboard/pagination";
import { getSeasonById } from "@/server/catalog";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/order-state";
import { formatDateTimeWIB } from "@/lib/dates";
import { formatRp } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Pesanan", robots: { index: false, follow: false } };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const viewer = await requireCustomer("/dashboard/pesanan");
  const params = await searchParams;
  const page = await orderHistoryForUser(viewer.user.id, params.cursor);
  const orders = page.items;
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
          title={params.cursor ? "Tidak ada pesanan di halaman ini" : "Belum ada pesanan"}
          description={params.cursor ? "Kembali ke daftar terbaru untuk melanjutkan." : "Setelah membeli rank atau kit, pesanan dan kuitansinya muncul di sini."}
          action={<Link href={params.cursor ? "/dashboard/pesanan" : "/rank"} className="text-[13px] text-accent hover:underline">{params.cursor ? "Lihat pesanan terbaru" : "Lihat rank"}</Link>}
        />
      ) : (
        <div className="dashboard-scroll mt-6 max-h-[42rem] space-y-2 overflow-y-auto pr-1" tabIndex={0} role="region" aria-label="Daftar pesanan, gulir untuk melihat semua">
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
      <Pagination path="/dashboard/pesanan" parameter="cursor" previous={page.previous} next={page.next} label="Halaman riwayat pembelian" />
    </div>
  );
}
