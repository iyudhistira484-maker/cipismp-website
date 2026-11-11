import Link from "next/link";
import { LayoutDashboard, Package, ShieldCheck, Gamepad2 } from "lucide-react";
import { requireViewer } from "@/server/auth/guard";
import { SiteFooter } from "@/components/store/site-footer";
import { SiteHeader } from "@/components/store/site-header";
import { Alert } from "@/components/ui/feedback";
import { getActiveSeason } from "@/server/catalog";
import { formatDateWIB } from "@/lib/dates";
import { isStaff } from "@/server/rbac";
import { LogoutButton } from "@/components/store/logout-button";
import { ResendVerificationForm } from "@/components/store/resend-verification";

const NAV = [
  { href: "/dashboard", label: "Ringkasan", icon: LayoutDashboard },
  { href: "/dashboard/pesanan", label: "Pesanan", icon: Package },
  { href: "/dashboard/minecraft", label: "Akun Minecraft", icon: Gamepad2 },
  { href: "/dashboard/keamanan", label: "Keamanan", icon: ShieldCheck },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const season = await getActiveSeason();

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="konten" className="flex-1">
        <div className="container-page grid gap-8 py-10 lg:grid-cols-[220px_1fr] lg:py-12">
          <aside>
            <div className="rounded-lg border border-line bg-surface/60 p-4">
              <p className="text-2xs uppercase tracking-wider text-muted-2">Masuk sebagai</p>
              <p className="mt-1 truncate text-[14px] text-ink">{viewer.user.displayName ?? viewer.user.username}</p>
              <p className="truncate text-2xs text-muted-2">{viewer.user.email}</p>
              <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
                <Link href="/" className="text-[12.5px] text-muted transition-colors hover:text-accent">
                  Kembali ke toko
                </Link>
                {isStaff(viewer.user.role) ? (
                  <Link href="/admin" className="text-[12.5px] text-accent transition-colors hover:text-accent-strong">
                    Panel admin
                  </Link>
                ) : null}
                <LogoutButton />
              </div>
            </div>

            <nav aria-label="Navigasi dashboard" className="mt-4 space-y-0.5">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <item.icon className="size-4" aria-hidden />
                  {item.label}
                </Link>
              ))}
            </nav>

            {season ? (
              <div className="mt-5 rounded-md border border-line bg-surface/40 p-3">
                <p className="text-2xs uppercase tracking-wider text-muted-2">Season aktif</p>
                <p className="mt-1 text-[13px] text-ink">{season.name}</p>
                <p className="text-2xs text-muted-2">Berakhir {formatDateWIB(season.endAt)}</p>
              </div>
            ) : null}
          </aside>

          <div className="min-w-0">
            {!viewer.user.emailVerifiedAt ? (
              <div className="mb-6">
                <Alert tone="warning" title="Email belum diverifikasi">
                  Checkout dengan akun memerlukan email terverifikasi. Checkout sebagai tamu tetap bisa.
                  <ResendVerificationForm />
                </Alert>
              </div>
            ) : null}
            {children}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
