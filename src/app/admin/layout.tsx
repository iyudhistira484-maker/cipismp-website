import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, PanelLeft } from "lucide-react";
import { requireStaff } from "@/server/auth/guard";
import { Logo } from "@/components/art/item-art";
import { hasPermission, ROLE_LABEL, type Permission } from "@/server/rbac";
import { LogoutButton } from "@/components/store/logout-button";
import { DashboardNavigation, type DashboardNavItem } from "@/components/dashboard/navigation";

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

  return (
    <div className="min-h-dvh bg-[#faf8f9] text-ink">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col lg:flex-row">
        <aside className="z-20 min-w-0 border-b border-line bg-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-[250px] lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-4 px-5 py-4 lg:px-5 lg:py-6">
            <Link href="/admin" aria-label="CipiSMP — panel admin"><Logo /></Link>
            <Link href="/" className="rounded-md border border-line p-2 text-muted hover:text-accent lg:hidden" aria-label="Lihat toko"><ArrowUpRight className="size-4" /></Link>
          </div>
          <div className="min-h-0 px-3 pb-3 lg:flex-1 lg:pb-0"><DashboardNavigation items={items} label="Navigasi admin" /><p className="px-3 pt-1 text-[10px] text-muted-2 lg:hidden">Geser menu untuk melihat lainnya →</p></div>
          <div className="hidden border-t border-line px-4 py-4 lg:block">
            <Link href="/admin/profil" className="flex items-center gap-3 rounded-md p-1.5 hover:bg-surface-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-3 text-[13px] font-semibold text-accent-strong">{name.slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0"><span className="block truncate text-[13px] font-semibold text-ink">{name}</span><span className="block text-2xs text-muted-2">{ROLE_LABEL[viewer.user.role]} · Profil saya</span></span>
            </Link>
            <div className="mt-2 px-1.5"><LogoutButton /></div>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <div className="flex min-h-14 items-center justify-between gap-3 border-b border-line bg-white/70 px-5 sm:px-8 lg:px-10">
            <p className="flex items-center gap-2 text-[12px] text-muted-2"><PanelLeft className="size-4" aria-hidden /> CipiSMP <span className="text-line-strong">/</span> <span className="font-medium text-muted">Admin</span></p>
            <Link href="/" className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted hover:text-accent-strong">Lihat toko <ArrowUpRight className="size-3.5" aria-hidden /></Link>
          </div>
          <main id="konten" className="mx-auto min-w-0 max-w-[1500px] px-4 py-7 sm:px-8 lg:px-10 lg:py-9">{children}</main>
        </div>
      </div>
    </div>
  );
}
