import Link from "next/link";
import { ShoppingBag, LayoutDashboard } from "lucide-react";
import { Logo } from "@/components/art/item-art";
import { getViewer } from "@/server/auth/guard";
import { getCartCount } from "@/server/cart";
import { getSettings } from "@/server/settings";
import { isStaff } from "@/server/rbac";
import { MobileNav } from "./mobile-nav";
import { t } from "@/lib/i18n";

const NAV = [
  { href: "/rank", label: t("nav.ranks") },
  { href: "/kit", label: t("nav.kits") },
  { href: "/ulasan", label: "Ulasan" },
  { href: "/cara-kerja", label: t("nav.how") },
  { href: "/faq", label: t("nav.faq") },
];

export async function SiteHeader() {
  const [viewer, cartCount, settings] = await Promise.all([getViewer(), getCartCount(), getSettings()]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-md">
      {settings.site.announcement ? (
        <div className="border-b border-line bg-surface-2">
          <p className="container-page py-2 text-center text-[12.5px] font-medium text-accent-strong">{settings.site.announcement}</p>
        </div>
      ) : null}
      <div className="container-page flex h-[72px] items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Link href="/" aria-label="CipiSMP Store — beranda" className="transition-opacity hover:opacity-90">
            <Logo />
          </Link>
          <nav aria-label="Navigasi utama" className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-[13.5px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            href="/keranjang"
            className="relative inline-flex size-10 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            aria-label={`Keranjang, ${cartCount} item`}
          >
            <ShoppingBag className="size-[18px]" aria-hidden />
            {cartCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 grid size-[18px] place-items-center rounded-full bg-accent text-[10px] font-semibold text-accent-ink">
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            ) : null}
          </Link>

          {viewer ? (
            <Link
              href={isStaff(viewer.user.role) ? "/admin" : "/dashboard"}
              className="hidden items-center gap-2 rounded-md border border-line-strong bg-surface-2 px-3 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-surface-3 sm:inline-flex"
            >
              <LayoutDashboard className="size-4" aria-hidden />
              {viewer.user.displayName ?? viewer.user.username}
            </Link>
          ) : (
            <Link
              href="/masuk"
              className="hidden rounded-md border border-line-strong bg-surface-2 px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-surface-3 sm:inline-flex"
            >
              {t("nav.login")}
            </Link>
          )}

          <MobileNav
            items={NAV}
            signedIn={Boolean(viewer)}
            cartCount={cartCount}
            isStaff={isStaff(viewer?.user.role ?? "CUSTOMER")}
          />
        </div>
      </div>
    </header>
  );
}
