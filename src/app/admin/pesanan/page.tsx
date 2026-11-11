import Link from "next/link";
import { requireStaff } from "@/server/auth/guard";
import { listOrders } from "@/server/admin/queries";
import { ORDER_STATUSES, ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/order-state";
import { formatRp } from "@/lib/money";
import { formatDateTimeWIB } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { AdminPageHeader, Table, Td } from "@/components/admin/shell";

export const metadata = { title: "Pesanan" };

function statusTone(status: string) {
  if (status === "DELIVERED") return "success" as const;
  if (status === "FAILED" || status === "DISPUTED") return "danger" as const;
  if (status === "PENDING" || status === "EXPIRED") return "warning" as const;
  return "info" as const;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireStaff("orders.read");
  const params = await searchParams;
  const orders = await listOrders({ status: params.status, query: params.q, limit: 100 });

  return (
    <>
      <AdminPageHeader
        title="Pesanan"
        description="Cari berdasarkan nomor order, email, atau nama pemain. Perubahan status tercatat di audit log."
      />

      <form className="mb-4 flex flex-wrap items-end gap-2" method="get">
        <Field label="Cari" htmlFor="order-q" className="min-w-56 flex-1">
          <Input id="order-q" name="q" defaultValue={params.q ?? ""} placeholder="CIPI-20250101-0001 / email / pemain" />
        </Field>
        <Field label="Status" htmlFor="order-status" className="w-52">
          <Select id="order-status" name="status" defaultValue={params.status ?? ""}>
            <option value="">Semua status</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {ORDER_STATUS_LABEL[status]}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" variant="secondary">Terapkan</Button>
        {params.q || params.status ? (
          <Link href="/admin/pesanan" className="text-2xs text-muted underline-offset-2 hover:text-accent hover:underline">
            Reset
          </Link>
        ) : null}
      </form>

      <Table head={["Order", "Pembeli", "Pemain", "Status", "Gateway", "Total", "Dibuat"]} empty={orders.length === 0}>
        {orders.map((order) => (
          <tr key={order.id} className="hover:bg-surface-2/40">
            <Td>
              <Link href={`/admin/pesanan/${order.id}`} className="text-ink hover:text-accent">
                {order.orderNumber}
              </Link>
            </Td>
            <Td>{order.email}</Td>
            <Td>{order.mcName}</Td>
            <Td>
              <Badge tone={statusTone(order.status)}>{ORDER_STATUS_LABEL[order.status as OrderStatus]}</Badge>
            </Td>
            <Td>{order.provider ?? "—"}</Td>
            <Td className="tabular-nums text-ink">{formatRp(order.totalIdr)}</Td>
            <Td>{formatDateTimeWIB(order.createdAt)}</Td>
          </tr>
        ))}
      </Table>
      <p className="mt-2 text-2xs text-muted-2">Menampilkan maksimal 100 order terakhir. Persempit dengan filter untuk hasil lain.</p>
    </>
  );
}
