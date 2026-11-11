import { requireStaff } from "@/server/auth/guard";
import { listAuditTrail } from "@/server/admin/queries";
import { formatDateTimeWIB } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { AdminPageHeader, Table, Td } from "@/components/admin/shell";

export const metadata = { title: "Audit log" };

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  await requireStaff("audit.read");
  const params = await searchParams;
  const rows = await listAuditTrail({ action: params.action, limit: 150 });

  return (
    <>
      <AdminPageHeader
        title="Audit log"
        description="Setiap aksi staf dan sistem yang mengubah uang, entitlement, atau pengaturan dicatat di sini. Log tidak bisa dihapus dari panel."
      />

      <form className="mb-4 flex flex-wrap items-end gap-2" method="get">
        <Field label="Filter aksi" htmlFor="audit-action" className="min-w-64 flex-1">
          <Input id="audit-action" name="action" defaultValue={params.action ?? ""} placeholder="order.manual-paid, season.transition, product.updated" />
        </Field>
        <Button type="submit" variant="secondary">Terapkan</Button>
      </form>

      <Table head={["Waktu", "Aktor", "Aksi", "Target", "Alasan", "IP"]} empty={rows.length === 0}>
        {rows.map((row) => (
          <tr key={row.id}>
            <Td className="whitespace-nowrap">{formatDateTimeWIB(row.createdAt)}</Td>
            <Td className="text-ink">{row.actorLabel}</Td>
            <Td className="font-mono text-2xs text-accent">{row.action}</Td>
            <Td className="text-2xs">
              {row.targetType}
              {row.targetId ? <span className="block font-mono text-muted-2">{row.targetId}</span> : null}
            </Td>
            <Td className="max-w-64 text-2xs">{row.reason ?? "—"}</Td>
            <Td className="font-mono text-2xs">{row.ip ?? "—"}</Td>
          </tr>
        ))}
      </Table>
      <p className="mt-2 text-2xs text-muted-2">Menampilkan maksimal 150 entri terbaru.</p>
    </>
  );
}
