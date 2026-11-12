import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { requireCustomer } from "@/server/auth/guard";
import { SiteFooter } from "@/components/store/site-footer";
import { SiteHeader } from "@/components/store/site-header";
import { Alert } from "@/components/ui/feedback";
import { getActiveSeason } from "@/server/catalog";
import { formatDateWIB } from "@/lib/dates";
import { LogoutButton } from "@/components/store/logout-button";
import { ResendVerificationForm } from "@/components/store/resend-verification";
import { DashboardNavigation, type DashboardNavItem } from "@/components/dashboard/navigation";

const NAV: DashboardNavItem[] = [
  { href: "/dashboard", label: "Ringkasan", icon: "LayoutDashboard", group: "Akun saya" },
  { href: "/dashboard/pesanan", label: "Pesanan", icon: "Package", group: "Akun saya" },
  { href: "/dashboard/item", label: "Rank & kit", icon: "Boxes", group: "Akun saya" },
  { href: "/dashboard/hadiah", label: "Hadiah", icon: "Gift", group: "Akun saya" },
  { href: "/dashboard/bantuan", label: "Bantuan", icon: "LifeBuoy", group: "Akun saya" },
  { href: "/dashboard/notifikasi", label: "Notifikasi", icon: "Bell", group: "Pengaturan" },
  { href: "/dashboard/profil", label: "Profil", icon: "UserRound", group: "Pengaturan" },
  { href: "/dashboard/minecraft", label: "Akun Minecraft", icon: "Gamepad2", group: "Pengaturan" },
  { href: "/dashboard/keamanan", label: "Keamanan", icon: "ShieldCheck", group: "Pengaturan" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireCustomer();
  const season = await getActiveSeason();
  const name = viewer.user.displayName ?? viewer.user.username;

  return (
    <div className="flex min-h-dvh flex-col bg-[#faf8f9]">
      <SiteHeader />
      <main id="konten" className="flex-1">
        <div className="container-page grid gap-6 py-7 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10 lg:py-10">
          <aside className="min-w-0 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto">
            <div className="rounded-xl border border-line bg-white p-4 shadow-card">
              <Link href="/dashboard/profil" className="flex min-w-0 items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-3 font-display text-lg font-semibold text-accent-strong">{name.slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0"><span className="block truncate text-[14px] font-semibold text-ink">{name}</span><span className="block truncate text-[11px] text-muted-2">@{viewer.user.username}</span></span>
              </Link>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3">
                <LogoutButton />
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-line bg-white p-2 shadow-card"><DashboardNavigation items={NAV} label="Navigasi dashboard" /><p className="px-3 pb-1 pt-1 text-[10px] text-muted-2 lg:hidden">Geser menu untuk melihat lainnya →</p></div>
            {season ? (
              <div className="mt-3 hidden rounded-xl border border-line bg-surface-2/60 p-4 lg:block">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.12em] text-muted-2"><CalendarDays className="size-3.5" /> Season aktif</div>
                <p className="mt-2 text-[13px] font-semibold text-ink">{season.name}</p>
                <p className="mt-0.5 text-[12px] text-muted">Berakhir {formatDateWIB(season.endAt)}</p>
              </div>
            ) : null}
          </aside>
          <div className="min-w-0">
            {!viewer.user.emailVerifiedAt ? (
              <div className="mb-6"><Alert tone="warning" title="Email belum diverifikasi">Checkout dengan akun memerlukan email terverifikasi. Checkout sebagai tamu tetap bisa.<ResendVerificationForm /></Alert></div>
            ) : null}
            {children}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
