import { requireStaff } from "@/server/auth/guard";
import { listStaffAccounts, staffSessions } from "@/server/admin/queries";
import { ROLE_LABEL, hasPermission } from "@/server/rbac";
import { formatDateTimeWIB } from "@/lib/dates";
import { deviceLabel } from "@/server/auth/session";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/feedback";
import { AdminPageHeader, Card, Table, Td } from "@/components/admin/shell";
import { RevokeAllSessionsButton, RevokeSessionButton, StaffRoleForm } from "@/components/admin/admin-forms";

export const metadata = { title: "Staf" };

const MATRIX = [
  { label: "Pesanan, pelanggan, pengiriman, audit; kirim ulang, comp/cabut entitlement", value: "Support ke atas" },
  { label: "Pendapatan, produk, season, kupon, ulasan, metode pembayaran & pengaturan toko", value: "Admin ke atas" },
  { label: "Kesiapan/kredensial gateway, pembayaran menunggu/webhook, ubah role & cabut sesi staf", value: "Owner" },
];

export default async function AdminStaffPage() {
  const viewer = await requireStaff("staff.write");
  const [staff, sessions] = await Promise.all([listStaffAccounts(), staffSessions()]);
  const canManage = hasPermission(viewer.user.role, "staff.write");
  const sessionsByUser = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const list = sessionsByUser.get(session.userId) ?? [];
    list.push(session);
    sessionsByUser.set(session.userId, list);
  }

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
                <div className="space-y-1.5">
                  {member.id === viewer.user.id ? (
                    <span className="text-2xs text-muted-2">Akun sendiri</span>
                  ) : member.role === "OWNER" ? (
                    <span className="text-2xs text-muted-2">Gunakan CLI seed-owner</span>
                  ) : (
                    <StaffRoleForm userId={member.id} role={member.role} disabled={!canManage} />
                  )}
                  {canManage && member.id !== viewer.user.id && member.role !== "OWNER" ? (
                    <RevokeAllSessionsButton userId={member.id} />
                  ) : null}
                </div>
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

      <Card
        className="mt-4"
        title="Sesi staf aktif"
        description="Sesi yang masih berlaku (login belum kedaluwarsa atau dicabut). Cabut bila ada perangkat hilang atau akses perlu dihentikan segera."
      >
        <Table head={["Staf", "Role", "Perangkat", "IP", "Login terakhir", "2FA sesi", "Aksi"]} empty={sessions.length === 0}>
          {sessions.map((session) => (
            <tr key={session.id}>
              <Td className="text-ink">{session.email}</Td>
              <Td>{ROLE_LABEL[session.role as keyof typeof ROLE_LABEL] ?? session.role}</Td>
              <Td className="max-w-48 truncate text-2xs">{deviceLabel(session.userAgent)}</Td>
              <Td className="font-mono text-2xs">{session.ip ?? "—"}</Td>
              <Td>{formatDateTimeWIB(session.lastSeenAt)}</Td>
              <Td>{session.mfaSatisfiedAt ? <span className="text-success">terpenuhi</span> : <span className="text-warning">belum</span>}</Td>
              <Td>
                {session.userId === viewer.user.id ? (
                  <span className="text-2xs text-muted-2">Sesi ini</span>
                ) : canManage ? (
                  <RevokeSessionButton sessionId={session.id} />
                ) : (
                  <span className="text-2xs text-muted-2">—</span>
                )}
              </Td>
            </tr>
          ))}
        </Table>
        <p className="mt-2 text-2xs text-muted-2">
          Sesi staf berakhir otomatis setelah tidak aktif (bawaan 120 menit) atau setelah 168 jam, dan selalu
          butuh 2FA saat login ulang.
        </p>
      </Card>
    </>
  );
}
