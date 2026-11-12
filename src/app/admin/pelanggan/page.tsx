import Link from "next/link";
import { requireStaff } from "@/server/auth/guard";
import { listCustomers } from "@/server/admin/queries";
import { formatRp } from "@/lib/money";
import { formatDateWIB } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { AdminPageHeader, Table, Td } from "@/components/admin/shell";
import { ExportLink } from "@/components/admin/export-link";

export const metadata = { title: "Pelanggan" };

export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireStaff("customers.read");
  const params = await searchParams;
  const customers = await listCustomers(params.q, 100);

  return (
    <>
      <AdminPageHeader
        title="Pelanggan"
        description="Total belanja memakai order dibayar yang tertaut langsung ke akun; order tamu tidak dicocokkan lewat email. Akun yang dihapus tetap menyisakan order untuk pembukuan."
        actions={<ExportLink type="customers" label="Ekspor CSV" />}
      />

      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-[20px] border border-line bg-white p-5 shadow-card" method="get">
        <Field label="Cari pelanggan" htmlFor="customer-q" className="min-w-0 flex-[1_1_16rem]">
          <Input id="customer-q" name="q" defaultValue={params.q ?? ""} placeholder="email atau username" />
        </Field>
        <Button type="submit" variant="secondary">Cari</Button>
      </form>

      <Table head={["Email", "Username", "Total belanja", "Order dibayar", "Terdaftar"]} empty={customers.length === 0}>
        {customers.map((customer) => (
          <tr key={customer.id}>
            <Td>
              <Link href={`/admin/pelanggan/${customer.id}`} className="text-ink hover:text-accent">{customer.email}</Link>
            </Td>
            <Td>{customer.username}</Td>
            <Td className="tabular-nums text-ink">{formatRp(customer.totalSpentIdr)}</Td>
            <Td className="tabular-nums">{customer.paidOrderCount}</Td>
            <Td>{formatDateWIB(customer.createdAt)}</Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
