import Link from "next/link";
import { requireStaff } from "@/server/auth/guard";
import { deliveryMonitor } from "@/server/admin/queries";
import { hasPermission } from "@/server/rbac";
import { DELIVERY_STATUS_LABEL } from "@/lib/order-state";
import { formatDateTimeWIB } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { AdminPageHeader, Stat, Table, Td } from "@/components/admin/shell";
import { RedeliverButton } from "@/components/admin/admin-forms";

export const metadata = { title: "Pengiriman" };

export default async function AdminDeliveryPage() {
  const viewer = await requireStaff("delivery.read");
  const canRedeliver = hasPermission(viewer.user.role, "orders.redeliver");
  const { rows, stats } = await deliveryMonitor(150);

  return (
    <>
      <AdminPageHeader
        title="Monitor pengiriman"
        description="Periksa hasil di server sebelum kirim ulang. Pengiriman RCON yang SENT atau hasilnya tidak pasti memerlukan rekonsiliasi manual; jangan pindah metode untuk mem-bypass antrean."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Antrean" value={String(stats.QUEUED ?? 0)} />
        <Stat label="Terkirim" value={String(stats.SENT ?? 0)} />
        <Stat label="Diterima" value={String(stats.DELIVERED ?? 0)} tone="success" />
        <Stat label="Gagal (retry)" value={String(stats.FAILED ?? 0)} />
        <Stat label="Gagal permanen" value={String(stats.DEAD ?? 0)} tone={(stats.DEAD ?? 0) > 0 ? "danger" : "success"} />
      </div>

      <Table head={["Pemain", "Order", "Status", "Metode", "Percobaan", "Error terakhir", "Diperbarui", "Aksi"]} empty={rows.length === 0}>
        {rows.map((row) => (
          <tr key={row.id}>
            <Td className="text-ink">{row.playerName}</Td>
            <Td>
              {row.orderId ? (
                <Link href={`/admin/pesanan/${row.orderId}`} className="hover:text-accent">
                  {row.orderNumber ?? "detail"}
                </Link>
              ) : (
                <span className="text-2xs text-muted-2">comp / pencabutan</span>
              )}
            </Td>
            <Td>
              <Badge tone={row.status === "DELIVERED" ? "success" : row.status === "DEAD" ? "danger" : row.status === "FAILED" ? "warning" : "neutral"}>
                {DELIVERY_STATUS_LABEL[row.status] ?? row.status}
              </Badge>
            </Td>
            <Td>{row.method}</Td>
            <Td className="tabular-nums">{row.attempts}</Td>
            <Td className="max-w-64 text-2xs text-danger">{row.lastError ?? "—"}</Td>
            <Td>{formatDateTimeWIB(row.updatedAt)}</Td>
            <Td>
              {row.status === "DELIVERED" ? (
                <span className="text-2xs text-success">Selesai</span>
              ) : canRedeliver && ["FAILED", "DEAD"].includes(row.status) ? (
                <RedeliverButton deliveryId={row.id} />
              ) : (
                <span className="text-2xs text-muted-2">Kirim ulang hanya untuk pengiriman gagal setelah pemeriksaan</span>
              )}
            </Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
