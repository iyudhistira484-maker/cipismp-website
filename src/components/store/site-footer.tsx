import Link from "next/link";
import { Logo } from "@/components/art/item-art";
import { getSettings } from "@/server/settings";
import { t } from "@/lib/i18n";

export async function SiteFooter() {
  const settings = await getSettings();
  return (
    <footer className="mt-24 border-t border-line bg-white">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr] xl:gap-10 xl:py-12">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-pretty text-[13.5px] leading-relaxed text-muted">
            Toko resmi server survival CipiSMP. Rank dan akses kit berlaku sampai akhir season,
            diaktifkan otomatis setelah pembayaran terverifikasi.
          </p>
          <p className="mt-4 font-mono text-[11px] tracking-wide text-muted-2">
            Java cipismp.my.id · Bedrock port 19202
          </p>
        </div>
        <nav aria-label="Toko">
          <p className="mb-3 text-2xs uppercase tracking-wider text-muted-2">Toko</p>
          <ul className="space-y-2 text-[13.5px] text-muted">
            <li><Link href="/rank" className="hover:text-ink">Rank</Link></li>
            <li><Link href="/kit" className="hover:text-ink">Kit</Link></li>
            <li><Link href="/ulasan" className="hover:text-ink">Ulasan</Link></li>
            <li><Link href="/status-pesanan" className="hover:text-ink">Cek pesanan</Link></li>
            <li><Link href="/cara-kerja" className="hover:text-ink">Cara kerja</Link></li>
          </ul>
        </nav>
        <nav aria-label="Bantuan">
          <p className="mb-3 text-2xs uppercase tracking-wider text-muted-2">Bantuan</p>
          <ul className="space-y-2 text-[13.5px] text-muted">
            <li><Link href="/faq" className="hover:text-ink">FAQ</Link></li>
            <li>
              <a href={`mailto:${settings.site.supportEmail}`} className="hover:text-ink">
                {settings.site.supportEmail}
              </a>
            </li>
            <li>
              <a href={settings.site.discordUrl} className="hover:text-ink" rel="noreferrer noopener" target="_blank">
                Discord
              </a>
            </li>
          </ul>
        </nav>
        <nav aria-label="Legal">
          <p className="mb-3 text-2xs uppercase tracking-wider text-muted-2">Legal</p>
          <ul className="space-y-2 text-[13.5px] text-muted">
            <li><Link href="/legal/syarat-layanan" className="hover:text-ink">Syarat Layanan</Link></li>
            <li><Link href="/legal/kebijakan-privasi" className="hover:text-ink">Kebijakan Privasi</Link></li>
            <li><Link href="/legal/syarat-penjualan" className="hover:text-ink">Syarat Penjualan</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-line/70">
        <div className="container-page flex flex-col gap-2 py-6 text-[12px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-3xl leading-relaxed">
            © {new Date().getFullYear()} CipiSMP. <strong className="font-semibold text-ink">{t("footer.disclaimer")}</strong>
          </p>
          <p className="shrink-0 text-2xs text-muted-2">{t("footer.noRefund")}</p>
        </div>
      </div>
    </footer>
  );
}
