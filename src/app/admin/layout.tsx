import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  BarChart3,
  Boxes,
  CalendarClock,
  CreditCard,
  LifeBuoy,
  MessageSquare,
  PackageCheck,
  ReceiptText,
  ScrollText,
  Settings2,
  Server,
  Ticket,
  Users,
} from "lucide-react";
import { requireStaff } from "@/server/auth/guard";
import { getSettings } from "@/server/settings";
import { hasPermission, isStaff, ROLE_LABEL, type Permission } from "@/server/rbac";
import { LogoutButton } from "@/components/store/logout-button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: { default: "Panel admin · CipiSMP", template: "%s · Admin CipiSMP" },
  robots: { index: false, follow: false },
};

interface NavItem {
  href: string;
  label: string;
  permission: Permission;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}

const NAV: NavItem[] = [
  { href: "/admin", label: "Ringkasan", permission: "orders.read", icon: BarChart3 },
  { href: "/admin/pesanan", label: "Pesanan", permission: "orders.read", icon: ReceiptText },
  { href: "/admin/pengiriman", label: "Pengiriman", permission: "delivery.read", icon: PackageCheck },
  { href: "/admin/produk", label: "Produk", permission: "products.write", icon: Boxes },
  { href: "/admin/season", label: "Season", permission: "seasons.write", icon: CalendarClock },
  { href: "/admin/pelanggan", label: "Pelanggan", permission: "customers.read", icon: Users },
  { href: "/admin/ulasan", label: "Ulasan", permission: "products.write", icon: MessageSquare },
  { href: "/admin/kupon", label: "Kupon", permission: "coupons.write", icon: Ticket },
  { href: "/admin/pembayaran", label: "Pembayaran", permission: "settings.read", icon: CreditCard },
  { href: "/admin/pengaturan", label: "Pengaturan", permission: "settings.write", icon: Settings2 },
  { href: "/admin/server", label: "Server & plugin", permission: "settings.read", icon: Server },
  { href: "/admin/staf", label: "Staf", permission: "staff.write", icon: LifeBuoy },
  { href: "/admin/audit", label: "Audit log", permission: "audit.read", icon: ScrollText },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireStaff();
  if (!isStaff(viewer.user.role)) redirect("/403");
  const settings = await getSettings();
  const items = NAV.filter((item) => hasPermission(viewer.user.role, item.permission));

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto flex w-full max-w-[1536px] flex-col lg:flex-row">
        <aside className="border-b border-line bg-surface/40 lg:min-h-dvh lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3 px-4 py-4 lg:block">
            <Link href="/admin" className="group inline-flex items-baseline gap-2">
              <span className="font-display text-[17px] tracking-tight text-ink">{settings.site.name}</span>
              <span className="text-2xs uppercase tracking-[0.18em] text-accent">Admin</span>
            </Link>
            <div className="flex items-center gap-2 lg:mt-3">
              <Badge tone="accent">{ROLE_LABEL[viewer.user.role]}</Badge>
              <LogoutButton />
            </div>
          </div>
          <nav aria-label="Navigasi admin" className="flex gap-1 overflow-x-auto px-2 pb-3 lg:block lg:space-y-0.5 lg:overflow-visible lg:px-2.5 lg:pb-6">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex shrink-0 items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-muted transition-colors hover:bg-surface-2/70 hover:text-ink"
              >
                <item.icon className="size-4 text-muted-2" aria-hidden />
                {item.label}
              </Link>
            ))}
          </nav>
          <p className="hidden px-4 pb-6 text-2xs leading-relaxed text-muted-2 lg:block">
            Perubahan penting dicatat di audit log beserta pelaku, IP, dan alasan bila diperlukan.
          </p>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
