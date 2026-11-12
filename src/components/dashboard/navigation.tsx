"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bell, Boxes, CalendarClock, ChevronDown, CreditCard, Gamepad2, Gift, LayoutDashboard, LifeBuoy, Megaphone, MessageSquare, Package, PackageCheck, Percent, ReceiptText, ScrollText, Server, Settings2, ShieldCheck, Ticket, UserRound, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/store/logout-button";

const icons: Record<string, LucideIcon> = { BarChart3, Bell, Boxes, CalendarClock, CreditCard, Gamepad2, Gift, LayoutDashboard, LifeBuoy, Megaphone, MessageSquare, Package, PackageCheck, Percent, ReceiptText, ScrollText, Server, Settings2, ShieldCheck, Ticket, UserRound, Users };

export interface DashboardNavItem { href: string; label: string; icon: string; group: string }

export function DashboardNavigation({ items, label }: { items: DashboardNavItem[]; label: string }) {
  const pathname = usePathname();
  const groups = [...new Set(items.map((item) => item.group))];
  return (
    <nav aria-label={label} tabIndex={0} className="dashboard-nav min-w-0 overflow-x-auto lg:max-h-full lg:overflow-x-hidden lg:overflow-y-auto">
      <div className="flex w-max gap-1 lg:block lg:w-auto lg:space-y-5">
        {groups.map((group) => (
          <div key={group} className="flex gap-1 lg:block lg:space-y-1">
            <p className="hidden px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-2 lg:block">{group}</p>
            {items.filter((item) => item.group === group).map((item) => {
              const Icon = icons[item.icon] ?? LayoutDashboard;
              const base = item.href.split("#")[0] ?? item.href;
              const active = !item.href.includes("#") && (pathname === base || (base !== "/admin" && base !== "/dashboard" && pathname.startsWith(`${base}/`)));
              return (
                <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("group flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2.5 text-[13px] font-medium transition-colors", active ? "bg-accent/[0.10] text-accent-strong" : "text-muted hover:bg-surface-2 hover:text-ink")}>
                  <Icon className={cn("size-4 shrink-0", active ? "text-accent-strong" : "text-muted-2 group-hover:text-accent")} aria-hidden />
                  {item.label}
                  {active ? <span className="ml-auto hidden size-1.5 rounded-full bg-accent lg:block" aria-hidden /> : null}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}

/** Compact, grouped navigation for staff on small screens. Items remain permission-filtered by the server. */
export function AdminMobileNavigation({ items, name, role, open, setOpen }: { items: DashboardNavItem[]; name: string; role: string; open: boolean; setOpen: (open: boolean) => void }) {
  const pathname = usePathname();
  const groups = [...new Set(items.map((item) => item.group))];
  const current = items.find((item) => !item.href.includes("#") && (pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`))));
  return (
    <div className="lg:hidden">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="admin-mobile-navigation" className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#e8dce6] bg-[#faf5f9] px-4 py-3 text-left text-[13px] font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50">
        <span><span className="mr-2 text-[10px] font-semibold uppercase tracking-wider text-muted-2">Menu</span>{" "}{current?.label ?? "Panel admin"}</span><ChevronDown className={cn("size-4 shrink-0 text-accent-strong transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <nav id="admin-mobile-navigation" aria-label="Navigasi admin" tabIndex={-1} hidden={!open} className="dashboard-scroll mt-2 max-h-[60vh] overflow-y-auto rounded-xl border border-line bg-white p-3 shadow-card">
        <div className="grid gap-4 sm:grid-cols-2">{groups.map((group) => <div key={group}><p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[.13em] text-muted-2">{group}</p><div className="space-y-0.5">{items.filter((item) => item.group === group).map((item) => {
          const Icon = icons[item.icon] ?? LayoutDashboard;
          const active = current?.href === item.href;
          return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-2.5 rounded-md px-3 py-2.5 text-[13px] font-medium", active ? "bg-accent/[0.10] text-accent-strong" : "text-muted hover:bg-surface-2 hover:text-ink")}><Icon className="size-4 shrink-0" aria-hidden />{item.label}</Link>;
        })}</div></div>)}</div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line px-3 pt-4"><div className="min-w-0"><p className="truncate text-[12px] font-semibold text-ink">{name}</p><p className="mt-0.5 text-[11px] text-muted-2">{role}</p></div><LogoutButton /></div>
      </nav>
    </div>
  );
}
