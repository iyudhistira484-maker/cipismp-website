import type { Metadata } from "next";
import { requireStaff } from "@/server/auth/guard";
import { hasPermission, ROLE_LABEL, type Permission } from "@/server/rbac";
import type { DashboardNavItem } from "@/components/dashboard/navigation";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = {
  title: { default: "Panel admin · CipiSMP", template: "%s · Admin CipiSMP" },
  robots: { index: false, follow: false },
};

type AdminNavItem = DashboardNavItem & { permission: Permission };
const NAV: AdminNavItem[] = [
  { href: "/admin", label: "Ringkasan", permission: "orders.read", icon: "BarChart3", group: "Workspace" },
  { href: "/admin/pesanan", label: "Pesanan", permission: "orders.read", icon: "ReceiptText", group: "Workspace" },
  { href: "/admin/pengiriman", label: "Pengiriman", permission: "delivery.read", icon: "PackageCheck", group: "Workspace" },
  { href: "/admin/bantuan", label: "Bantuan", permission: "orders.read", icon: "LifeBuoy", group: "Workspace" },
  { href: "/admin/notifikasi", label: "Notifikasi", permission: "orders.read", icon: "Bell", group: "Workspace" },
  { href: "/admin/pelanggan", label: "Pelanggan", permission: "customers.read", icon: "Users", group: "Workspace" },
  { href: "/admin/produk", label: "Produk", permission: "products.write", icon: "Boxes", group: "Toko & konten" },
  { href: "/admin/season", label: "Season", permission: "seasons.write", icon: "CalendarClock", group: "Toko & konten" },
  { href: "/admin/ulasan", label: "Ulasan", permission: "products.write", icon: "MessageSquare", group: "Toko & konten" },
  { href: "/admin/pengaturan#site-announcement", label: "Pengumuman", permission: "settings.write", icon: "Megaphone", group: "Toko & konten" },
  { href: "/admin/kupon", label: "Kupon", permission: "coupons.write", icon: "Ticket", group: "Promosi" },
  { href: "/admin/diskon", label: "Diskon otomatis", permission: "coupons.write", icon: "Percent", group: "Promosi" },
  { href: "/admin/pembayaran", label: "Pembayaran", permission: "settings.read", icon: "CreditCard", group: "Pengaturan" },
  { href: "/admin/pengaturan", label: "Pengaturan", permission: "settings.write", icon: "Settings2", group: "Pengaturan" },
  { href: "/admin/server", label: "Server & plugin", permission: "settings.read", icon: "Server", group: "Pengaturan" },
  { href: "/admin/staf", label: "Staf", permission: "staff.write", icon: "LifeBuoy", group: "Pengaturan" },
  { href: "/admin/audit", label: "Audit log", permission: "audit.read", icon: "ScrollText", group: "Pengaturan" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireStaff();
  const items: DashboardNavItem[] = [
    ...NAV.filter((item) => hasPermission(viewer.user.role, item.permission)),
    { href: "/admin/profil", label: "Profil admin", icon: "UserRound", group: "Akun" },
    { href: "/admin/keamanan", label: "Keamanan akun", icon: "ShieldCheck", group: "Akun" },
  ];
  const name = viewer.user.displayName ?? viewer.user.username;

  return <AdminShell items={items} name={name} role={ROLE_LABEL[viewer.user.role]}>{children}</AdminShell>;
}
