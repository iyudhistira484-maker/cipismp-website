import Link from "next/link";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { requireStaff } from "@/server/auth/guard";
import { analyticsSummary, listOrders, deliveryOverview, revenueTrend, listPublishedProductsForComp } from "@/server/admin/queries";
import { formatRp } from "@/lib/money";
import { formatDateWIB, formatDateTimeWIB } from "@/lib/dates";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/order-state";
import { Badge } from "@/components/ui/badge";
import { AdminPageHeader, Card, Stat, Table, Td } from "@/components/admin/shell";
import { CompForm } from "@/components/admin/admin-forms";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { reviewCounts } from "@/server/reviews";
import { hasPermission } from "@/server/rbac";

export const metadata = { title: "Ringkasan" };

export default async function AdminHomePage() {
  const viewer = await requireStaff("orders.read");
  const canReadAnalytics = hasPermission(viewer.user.role, "analytics.read");
  const canReadDelivery = hasPermission(viewer.user.role, "delivery.read");
  const canModerateReviews = hasPermission(viewer.user.role, "products.write");
  const canComp = hasPermission(viewer.user.role, "grants.write");

  // Ringkasan operasional dan detail pengiriman hanya diambil oleh role dengan izin terkait.
  const [summary, recentOrders, monitor, products, trend, reviews] = await Promise.all([
    canReadAnalytics ? analyticsSummary(new Date(), { includeDeliveryMetrics: canReadDelivery }) : Promise.resolve(null),
    listOrders({ limit: 8 }),
    canReadDelivery ? deliveryOverview(8) : Promise.resolve(null),
    canComp ? listPublishedProductsForComp() : Promise.resolve([]),
    canReadAnalytics ? revenueTrend(30) : Promise.resolve([]),
    canModerateReviews ? reviewCounts() : Promise.resolve(null),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Ringkasan toko"
        description={
          canReadAnalytics
            ? "Angka pendapatan dihitung dari order berstatus dibayar. Tidak ada refund: semua penjualan final."
            : canReadDelivery
              ? "Tampilan operasional untuk pesanan dan pengiriman yang perlu ditindaklanjuti."
              : "Tampilan operasional untuk pesanan yang perlu ditindaklanjuti."
        }
      />

      {summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Pendapatan hari ini" value={formatRp(summary.revenueTodayIdr)} hint={`30 hari: ${formatRp(summary.revenue30dIdr)}`} tone="success" />
            <Stat label="Total pendapatan" value={formatRp(summary.revenueAllIdr)} hint={`${summary.paidOrders} order dibayar`} />
            <Stat label="Menunggu bayar" value={String(summary.pendingOrders)} />
            <Stat
              label="Perlu perhatian"
              value={String(summary.needsAttention)}
              hint={canReadDelivery ? `${summary.deadDeliveries} pengiriman gagal permanen` : undefined}
              tone={summary.needsAttention > 0 ? "danger" : "success"}
            />
          </div>

          {summary.activeSeason ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-accent/25 bg-accent/[0.05] px-4 py-3 text-[13px]">
              <span className="text-accent">Season aktif</span>
              <span className="text-ink">{summary.activeSeason.name}</span>
              <span className="text-muted">berakhir {formatDateTimeWIB(summary.activeSeason.endAt)} WIB</span>
              <Link href="/admin/season" className="ml-auto inline-flex items-center gap-1 text-2xs text-muted hover:text-accent">
                Kelola season <ArrowUpRight className="size-3" aria-hidden />
              </Link>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/[0.06] px-4 py-3 text-[13px] text-warning">
              <AlertTriangle className="size-4" aria-hidden />
              Tidak ada season aktif. Toko tidak bisa menjual sampai season diaktifkan.
            </div>
          )}

          {reviews && reviews.PENDING > 0 ? (
            <Link
              href="/admin/ulasan"
              className="mt-3 flex items-center gap-2 rounded-lg border border-info/25 bg-info/[0.05] px-4 py-3 text-[13px] text-info hover:border-info/50"
            >
              <span className="font-medium">{reviews.PENDING} ulasan menunggu moderasi</span>
              <span className="text-muted">Setujui atau sembunyikan agar halaman produk tetap rapi.</span>
              <ArrowUpRight className="ml-auto size-3.5" aria-hidden />
            </Link>
          ) : null}

          <Card title="Tren pendapatan" className="mt-4" description="30 hari terakhir, hanya order yang sudah dibayar.">
            <RevenueChart points={trend} />
          </Card>
        </>
      ) : monitor ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Stat label="Pengiriman gagal" value={String(monitor.stats.FAILED ?? 0)} hint="Dapat dicoba ulang dari monitor pengiriman." />
          <Stat
            label="Gagal permanen"
            value={String(monitor.stats.DEAD ?? 0)}
            hint="Periksa error dan kesehatan server sebelum kirim ulang."
            tone={(monitor.stats.DEAD ?? 0) > 0 ? "danger" : "success"}
          />
        </div>
      ) : null}

      <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card title="Pesanan terbaru" description="8 order terakhir dari semua status.">
          <Table head={["Order", "Pemain", "Status", "Total", "Dibuat"]} empty={recentOrders.length === 0}>
            {recentOrders.map((order) => (
              <tr key={order.id}>
                <Td>
                  <Link href={`/admin/pesanan/${order.id}`} className="text-ink hover:text-accent">
                    {order.orderNumber}
                  </Link>
                </Td>
                <Td>{order.mcName}</Td>
                <Td>
                  <Badge tone={order.status === "DELIVERED" ? "success" : order.status === "FAILED" || order.status === "DISPUTED" ? "danger" : order.status === "PENDING" ? "warning" : "info"}>
                    {ORDER_STATUS_LABEL[order.status as OrderStatus]}
                  </Badge>
                </Td>
                <Td className="tabular-nums text-ink">{formatRp(order.totalIdr)}</Td>
                <Td>{formatDateWIB(order.createdAt)}</Td>
              </tr>
            ))}
          </Table>
        </Card>

        <div className="min-w-0 space-y-4">
          {monitor ? (
            <Card title="Monitor pengiriman" description="Antrean terakhir; kirim ulang dari halaman Pengiriman.">
              <Table head={["Pemain", "Status", "Percobaan"]} empty={monitor.rows.length === 0}>
                {monitor.rows.map((row) => (
                  <tr key={row.id}>
                    <Td className="text-ink">{row.playerName}</Td>
                    <Td>{row.status}</Td>
                    <Td className="tabular-nums">{row.attempts}</Td>
                  </tr>
                ))}
              </Table>
            </Card>
          ) : null}

          {canComp ? (
            <Card title="Comp manual" description="Berikan rank/kit tanpa pembayaran. Wajib beralasan dan tercatat di audit log.">
              <CompForm products={products} />
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
