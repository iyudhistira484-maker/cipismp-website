import { requireStaff } from "@/server/auth/guard";
import { listStaffAccounts } from "@/server/admin/queries";
import { ROLE_LABEL, hasPermission } from "@/server/rbac";
import { formatDateTimeWIB } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/feedback";
import { AdminPageHeader, Card, Table, Td } from "@/components/admin/shell";
import { StaffRoleForm } from "@/components/admin/admin-forms";

export const metadata = { title: "Staf" };

const MATRIX = [
  { label: "Melihat pesanan & pelanggan", value: "Support ke atas" },
  { label: "Tandai lunas manual, ubah produk/season/kupon", value: "Admin ke atas" },
  { label: "Kredensial gateway & ubah role staf", value: "Owner" },
];

export default async function AdminStaffPage() {
  const viewer = await requireStaff("staff.write");
  const staff = await listStaffAccounts();
  const canManage = hasPermission(viewer.user.role, "staff.write");

  return (
    <>
      <AdminPageHeader
        title="Staf"
        description="2FA wajib untuk semua staf dan tidak bisa dinonaktifkan sendiri. Perubahan role langsung berlaku dan tercatat di audit log."
      />

      {!canManage ? <Alert tone="warning">Hanya Owner yang bisa mengubah role staf.</Alert> : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Table head={["Email", "Username", "Role", "2FA", "Login terakhir", "Ubah role"]} empty={staff.length === 0}>
          {staff.map((member) => (
            <tr key={member.id}>
              <Td className="text-ink">{member.email}</Td>
              <Td>{member.username}</Td>
              <Td>
                <Badge tone={member.role === "OWNER" ? "gold" : member.role === "ADMIN" ? "accent" : "neutral"}>{ROLE_LABEL[member.role]}</Badge>
              </Td>
              <Td>{member.totpEnabledAt ? <span className="text-success">Aktif</span> : <span className="text-danger">Belum</span>}</Td>
              <Td>{member.lastLoginAt ? formatDateTimeWIB(member.lastLoginAt) : "—"}</Td>
              <Td>
                {member.id === viewer.user.id ? (
                  <span className="text-2xs text-muted-2">Akun sendiri</span>
                ) : member.role === "OWNER" ? (
                  <span className="text-2xs text-muted-2">Gunakan CLI seed-owner</span>
                ) : (
                  <StaffRoleForm userId={member.id} role={member.role} disabled={!canManage} />
                )}
              </Td>
            </tr>
          ))}
        </Table>

        <Card title="Matriks akses">
          <dl className="space-y-2 text-[12.5px]">
            {MATRIX.map((row) => (
              <div key={row.label} className="flex flex-wrap justify-between gap-1">
                <dt className="text-muted">{row.label}</dt>
                <dd className="text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-2xs leading-relaxed text-muted-2">
            Mencabut akses staf menurunkan role ke Pelanggan; entitlement dan riwayat order tidak berubah. Akun staf
            tidak bisa menghapus dirinya sendiri dari dashboard.
          </p>
        </Card>
      </div>
    </>
  );
}
