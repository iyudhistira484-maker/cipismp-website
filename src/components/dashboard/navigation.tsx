"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bell, Boxes, CalendarClock, CreditCard, Gamepad2, Gift, LayoutDashboard, LifeBuoy, Megaphone, MessageSquare, Package, PackageCheck, Percent, ReceiptText, ScrollText, Server, Settings2, ShieldCheck, Ticket, UserRound, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
