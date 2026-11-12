"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, PanelLeft } from "lucide-react";
import { Logo } from "@/components/art/item-art";
import { LogoutButton } from "@/components/store/logout-button";
import { AdminMobileNavigation, DashboardNavigation, type DashboardNavItem } from "@/components/dashboard/navigation";

export function AdminShell({ children, items, name, role }: { children: React.ReactNode; items: DashboardNavItem[]; name: string; role: string }) {
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggleMobile() {
    const next = !mobileOpen;
    setMobileOpen(next);
    if (next) requestAnimationFrame(() => document.getElementById("admin-mobile-navigation")?.focus());
  }

  return (
    <div className="min-h-dvh bg-[#f9f6f8] text-ink">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col lg:flex-row">
        <aside id="admin-sidebar" className={`z-20 min-w-0 border-b border-line bg-white lg:sticky lg:top-0 lg:h-dvh lg:w-[260px] lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r ${desktopOpen ? "lg:flex" : "lg:hidden"}`}>
          <div className="flex items-center justify-between gap-4 px-5 py-4 lg:px-6 lg:py-6">
            <Link href="/admin" aria-label="CipiSMP — panel admin"><Logo /></Link>
            <Link href="/" className="rounded-md border border-line p-2 text-muted hover:text-accent lg:hidden" aria-label="Lihat toko"><ArrowUpRight className="size-4" aria-hidden /></Link>
          </div>
          <div className="min-h-0 px-4 pb-4 lg:flex-1 lg:px-3 lg:pb-0"><AdminMobileNavigation items={items} name={name} role={role} open={mobileOpen} setOpen={setMobileOpen} /><div className="hidden h-full lg:block"><DashboardNavigation items={items} label="Navigasi admin" /></div></div>
          <div className="hidden border-t border-line px-4 py-4 lg:block">
            <Link href="/admin/profil" className="flex items-center gap-3 rounded-md p-1.5 hover:bg-surface-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-3 text-[13px] font-semibold text-accent-strong">{name.slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0"><span className="block truncate text-[13px] font-semibold text-ink">{name}</span><span className="block text-2xs text-muted-2">{role} · Profil saya</span></span>
            </Link>
            <div className="mt-2 px-1.5"><LogoutButton /></div>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <div className="flex min-h-14 items-center justify-between gap-3 border-b border-line bg-white/75 px-5 sm:px-8 lg:px-10">
            <div className="flex min-w-0 items-center gap-2 text-[12px] text-muted-2">
              <button type="button" onClick={() => setDesktopOpen(!desktopOpen)} aria-expanded={desktopOpen} aria-controls="admin-sidebar" aria-label={desktopOpen ? "Sembunyikan navigasi admin" : "Tampilkan navigasi admin"} title={desktopOpen ? "Sembunyikan navigasi" : "Tampilkan navigasi"} className="hidden size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 lg:inline-flex"><PanelLeft className="size-4" aria-hidden /></button>
              <button type="button" onClick={toggleMobile} aria-expanded={mobileOpen} aria-controls="admin-mobile-navigation" aria-label={mobileOpen ? "Tutup navigasi admin" : "Buka navigasi admin"} title={mobileOpen ? "Tutup navigasi" : "Buka navigasi"} className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 lg:hidden"><PanelLeft className="size-4" aria-hidden /></button>
              <span>CipiSMP</span><span className="text-line-strong">/</span><span className="font-medium text-muted">Admin</span>
            </div>
            <Link href="/" className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-muted hover:text-accent-strong">Lihat toko <ArrowUpRight className="size-3.5" aria-hidden /></Link>
          </div>
          <main id="konten" className="mx-auto min-w-0 max-w-[1500px] px-4 py-7 sm:px-8 lg:px-10 lg:py-9">{children}</main>
        </div>
      </div>
    </div>
  );
}
