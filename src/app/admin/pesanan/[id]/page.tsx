import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireStaff } from "@/server/auth/guard";
import { getOrderDetail } from "@/server/orders";
import { DELIVERY_STATUS_LABEL, ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/order-state";
import { formatRp } from "@/lib/money";
import { formatDateTimeWIB } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { AdminPageHeader, Card, Table, Td } from "@/components/admin/shell";
import { OrderAdminActions, RedeliverButton } from "@/components/admin/admin-forms";

export const metadata = { title: "Detail pesanan" };

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("orders.read");
  const { id } = await params;
  const detail = await getOrderDetail(id);
  if (!detail) notFound();
  const { order, items, payments, deliveries, season } = detail;

  return (
    <>
      <Link href="/admin/pesanan" className="mb-3 inline-flex items-center gap-1.5 text-2xs text-muted hover:text-accent">
        <ArrowLeft className="size-3" aria-hidden /> Semua pesanan
      </Link>
      <AdminPageHeader
        title={order.orderNumber}
        description={`${order.email} · ${order.mcName} · ${order.provider ?? "tanpa gateway"}`}
        actions={
          <>
            <Badge tone={order.status === "DELIVERED" ? "success" : order.status === "FAILED" ? "danger" : "info"}>
              {ORDER_STATUS_LABEL[order.status as OrderStatus]}
            </Badge>
            <Link href={`/pesanan/${order.publicToken}`} className="text-2xs text-muted underline-offset-2 hover:text-accent hover:underline">
              Halaman pembeli
            </Link>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <Card title="Item">
            <Table head={["Produk", "Penerima", "Harga", "Jumlah", "Subtotal"]} empty={items.length === 0}>
              {items.map((item) => (
                <tr key={item.id}>
                  <Td className="text-ink">{item.nameSnapshot}</Td>
                  <Td>
                    {item.targetName}
                    {item.meta?.giftFromName ? (
                      <span className="block text-2xs text-muted-2">hadiah dari {item.meta.giftFromName}</span>
                    ) : null}
                  </Td>
                  <Td className="tabular-nums">{formatRp(item.unitPriceIdr)}</Td>
                  <Td className="tabular-nums">{item.quantity}</Td>
                  <Td className="tabular-nums text-ink">{formatRp(item.lineTotalIdr)}</Td>
                </tr>
              ))}
            </Table>
            <dl className="mt-3 space-y-1 text-[12.5px]">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular-nums text-ink">{formatRp(order.subtotalIdr)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Diskon</dt><dd className="tabular-nums text-ink">−{formatRp(order.discountIdr)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Pajak</dt><dd className="tabular-nums text-ink">{formatRp(order.taxIdr)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Biaya</dt><dd className="tabular-nums text-ink">{formatRp(order.feeIdr)}</dd></div>
              <div className="flex justify-between border-t border-line pt-1.5"><dt className="text-ink">Total</dt><dd className="tabular-nums text-ink">{formatRp(order.totalIdr)}</dd></div>
            </dl>
            <p className="mt-2 text-2xs text-muted-2">
              Season: {season?.name ?? "—"} · dibuat {formatDateTimeWIB(order.createdAt)} · kadaluwarsa {formatDateTimeWIB(order.expiresAt)}
            </p>
          </Card>

          <Card title="Pengiriman">
            <Table head={["Pemain", "Status", "Metode", "Percobaan", "Error", "Aksi"]} empty={deliveries.length === 0}>
              {deliveries.map((delivery) => (
                <tr key={delivery.id}>
                  <Td className="text-ink">{delivery.playerName}</Td>
                  <Td>{DELIVERY_STATUS_LABEL[delivery.status] ?? delivery.status}</Td>
                  <Td>{delivery.method}</Td>
                  <Td className="tabular-nums">{delivery.attempts}</Td>
                  <Td className="max-w-56 text-2xs text-danger">{delivery.lastError ?? "—"}</Td>
                  <Td>{delivery.status !== "DELIVERED" ? <RedeliverButton deliveryId={delivery.id} /> : <span className="text-2xs text-success">Selesai</span>}</Td>
                </tr>
              ))}
            </Table>
          </Card>

          <Card title="Pembayaran">
            <Table head={["Gateway", "Referensi", "Status", "Nominal", "Dibuat"]} empty={payments.length === 0}>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <Td>{payment.provider}</Td>
                  <Td className="max-w-48 truncate text-2xs">{payment.providerRef}</Td>
                  <Td>{payment.status}</Td>
                  <Td className="tabular-nums text-ink">{formatRp(payment.amountIdr)}</Td>
                  <Td>{formatDateTimeWIB(payment.createdAt)}</Td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Aksi">
            <OrderAdminActions orderId={order.id} status={order.status} />
          </Card>
          {order.adminNote ? (
            <Card title="Catatan admin">
              <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-muted">{order.adminNote}</p>
            </Card>
          ) : null}
          <Card title="Kebijakan">
            <p className="text-2xs leading-relaxed text-muted-2">
              Toko tidak menyediakan refund. Order yang sudah dibayar tidak bisa dibatalkan; sengketa ditangani
              lewat status DISPUTED dan alert ke staf.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
