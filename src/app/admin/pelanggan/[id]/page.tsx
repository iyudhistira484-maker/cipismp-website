import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { requireStaff } from "@/server/auth/guard";
import { hasPermission } from "@/server/rbac";
import { customerDetail } from "@/server/admin/queries";
import { formatDateTimeWIB } from "@/lib/dates";
import { formatRp } from "@/lib/money";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/order-state";
import { Badge } from "@/components/ui/badge";
import { AdminPageHeader, Card, Table, Td } from "@/components/admin/shell";
import { PromoteCustomerForm, RevokeEntitlementButton } from "@/components/admin/admin-forms";

export const metadata = { title: "Detail pelanggan" };

function orderTone(status: string) {
  if (status === "DELIVERED") return "success" as const;
  if (status === "FAILED" || status === "DISPUTED") return "danger" as const;
  if (status === "PENDING" || status === "EXPIRED") return "warning" as const;
  return "info" as const;
}

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireStaff("customers.read");
  const canReadOrders = hasPermission(viewer.user.role, "orders.read");
  const canManageEntitlements = hasPermission(viewer.user.role, "grants.write");
  const { id } = await params;
  const detail = await customerDetail(id, {
    includeOrders: canReadOrders,
    includeEntitlements: canManageEntitlements,
  });
  if (!detail) notFound();

  const { customer, profiles, orders, entitlements } = detail;
  return (
    <>
      <Link href="/admin/pelanggan" className="mb-3 inline-flex items-center gap-1.5 text-2xs text-muted hover:text-accent">
        <ArrowLeft className="size-3" aria-hidden /> Semua pelanggan
      </Link>
      <AdminPageHeader
        title={customer.username}
        description={customer.email}
        actions={
          <>
            <Badge tone={customer.deletedAt ? "danger" : "neutral"}>{customer.deletedAt ? "Akun dihapus" : "Pelanggan"}</Badge>
            {customer.totpEnabledAt ? <Badge tone="success">2FA aktif</Badge> : <Badge tone="warning">2FA nonaktif</Badge>}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Akun">
          <dl className="grid gap-3 text-[12.5px] sm:grid-cols-2">
            <div><dt className="text-2xs uppercase tracking-wider text-muted-2">Email terverifikasi</dt><dd className="mt-1 text-ink">{customer.emailVerifiedAt ? formatDateTimeWIB(customer.emailVerifiedAt) : "Belum"}</dd></div>
            <div><dt className="text-2xs uppercase tracking-wider text-muted-2">Terdaftar</dt><dd className="mt-1 text-ink">{formatDateTimeWIB(customer.createdAt)}</dd></div>
            <div><dt className="text-2xs uppercase tracking-wider text-muted-2">Login terakhir</dt><dd className="mt-1 text-ink">{customer.lastLoginAt ? formatDateTimeWIB(customer.lastLoginAt) : "Belum pernah"}</dd></div>
            <div><dt className="text-2xs uppercase tracking-wider text-muted-2">Profil Minecraft</dt><dd className="mt-1 text-ink">{profiles.length}</dd></div>
          </dl>
        </Card>

        <Card title="Profil Minecraft" description="Hanya profil yang sudah ditautkan ke akun ini.">
          <Table head={["Pemain", "Edisi", "UUID", "Status verifikasi"]} empty={profiles.length === 0}>
            {profiles.map((profile) => (
              <tr key={profile.uuid}>
                <Td className="text-ink">{profile.displayName}</Td>
                <Td>{profile.edition}</Td>
                <Td className="font-mono text-2xs">{profile.uuid}</Td>
                <Td>{profile.verifiedAt ? <span className="text-success">Terverifikasi</span> : <span className="text-warning">Belum</span>}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      {hasPermission(viewer.user.role, "staff.write") && !customer.deletedAt ? (
        <Card title="Berikan akses website staf" className="mt-4" description="Hanya Owner dapat menaikkan akun yang sama menjadi staf. Pastikan identitas orangnya secara terpisah; email terverifikasi bukan bukti bahwa ia staf. Admin dapat mengelola produk, diskon dan pengaturan. Setelah promosi, daftarkan UUID di halaman Staf; ini tidak mengubah grup Minecraft.">
          {!customer.emailVerifiedAt || !customer.totpEnabledAt ? <p className="text-2xs text-danger">Pelanggan harus memverifikasi email dan mengaktifkan 2FA sendiri sebelum dapat dipromosikan.</p> : null}
          <PromoteCustomerForm userId={customer.id} username={customer.username} ready={Boolean(customer.emailVerifiedAt && customer.totpEnabledAt)} />
        </Card>
      ) : null}

      {canReadOrders ? (
        <Card title="Pesanan akun" className="mt-4" description="Maksimal 50 pesanan terbaru yang dibuat saat login ke akun ini.">
          <Table head={["Order", "Pemain", "Status", "Total", "Dibuat"]} empty={orders.length === 0}>
            {orders.map((order) => (
              <tr key={order.id}>
                <Td>
                  <Link href={`/admin/pesanan/${order.id}`} className="text-ink hover:text-accent">{order.orderNumber}</Link>
                </Td>
                <Td>{order.mcName}</Td>
                <Td><Badge tone={orderTone(order.status)}>{ORDER_STATUS_LABEL[order.status as OrderStatus]}</Badge></Td>
                <Td className="tabular-nums text-ink">{formatRp(order.totalIdr)}</Td>
                <Td>{formatDateTimeWIB(order.createdAt)}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      ) : null}

      {canManageEntitlements ? (
        <Card title="Akses rank & kit" className="mt-4" description="Untuk koreksi akses, bukan refund. Mencabut menonaktifkan entitlement; bila template REVOKE tersedia, perintah diantrekan ke server. Alasan wajib dan masuk audit log.">
          <Table head={["Produk", "Pemain / UUID", "Season", "Status", "Sumber", "Diberikan", "Aksi"]} empty={entitlements.length === 0}>
            {entitlements.map((entitlement) => (
              <tr key={entitlement.id}>
                <Td>
                  <span className="text-ink">{entitlement.productName}</span>
                  <span className="block text-2xs text-muted-2">{entitlement.productType === "RANK" ? "Rank" : "Kit"}</span>
                </Td>
                <Td>
                  <span className="block text-ink">{entitlement.playerName ?? "—"}</span>
                  <span className="block font-mono text-2xs text-muted-2">{entitlement.uuid}</span>
                </Td>
                <Td>
                  <span className="block text-ink">{entitlement.seasonName}</span>
                  <span className="block text-2xs text-muted-2">{entitlement.seasonStatus} · berakhir {formatDateTimeWIB(entitlement.seasonEndsAt)} WIB</span>
                </Td>
                <Td><Badge tone={entitlement.active ? "success" : "neutral"}>{entitlement.active ? "Aktif" : "Tidak aktif"}</Badge></Td>
                <Td>{entitlement.source === "PURCHASE" ? "Pembelian" : "Comp"}</Td>
                <Td>{formatDateTimeWIB(entitlement.createdAt)}</Td>
                <Td>{entitlement.active ? <RevokeEntitlementButton entitlementId={entitlement.id} /> : "—"}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      ) : null}
    </>
  );
}
