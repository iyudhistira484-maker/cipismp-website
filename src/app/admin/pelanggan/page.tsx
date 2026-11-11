import { requireStaff } from "@/server/auth/guard";
import { listCustomers } from "@/server/admin/queries";
import { formatRp } from "@/lib/money";
import { formatDateWIB, formatDateTimeWIB } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { AdminPageHeader, Table, Td } from "@/components/admin/shell";

export const metadata = { title: "Pelanggan" };

export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireStaff("customers.read");
  const params = await searchParams;
  const customers = await listCustomers(params.q, 100);

  return (
    <>
      <AdminPageHeader
        title="Pelanggan"
        description="Total belanja dihitung dari order berstatus dibayar. Akun yang dihapus tetap menyisakan order untuk pembukuan."
      />

      <form className="mb-4 flex flex-wrap items-end gap-2" method="get">
        <Field label="Cari pelanggan" htmlFor="customer-q" className="min-w-64 flex-1">
          <Input id="customer-q" name="q" defaultValue={params.q ?? ""} placeholder="email atau username" />
        </Field>
        <Button type="submit" variant="secondary">Cari</Button>
      </form>

      <Table head={["Email", "Username", "Role", "Email terverifikasi", "2FA", "Total belanja", "Order", "Daftar"]} empty={customers.length === 0}>
        {customers.map((customer) => (
          <tr key={customer.id}>
            <Td className="text-ink">{customer.email}</Td>
            <Td>{customer.username}</Td>
            <Td>{customer.role === "CUSTOMER" ? "Pelanggan" : customer.role}</Td>
            <Td>{customer.emailVerifiedAt ? <span className="text-success">Ya</span> : <span className="text-warning">Belum</span>}</Td>
            <Td>{customer.totpEnabledAt ? <span className="text-success">Aktif</span> : <span className="text-muted-2">Tidak</span>}</Td>
            <Td className="tabular-nums text-ink">{formatRp(customer.totalSpentIdr)}</Td>
            <Td className="tabular-nums">{customer.paidOrderCount}</Td>
            <Td>{formatDateWIB(customer.createdAt)}</Td>
          </tr>
        ))}
      </Table>
      <p className="mt-2 text-2xs text-muted-2">
        Login terakhir salah satu pelanggan:{" "}
        {customers[0]?.lastLoginAt ? formatDateTimeWIB(customers[0].lastLoginAt) : "belum ada data"}.
      </p>
    </>
  );
}
