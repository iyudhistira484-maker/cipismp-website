import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Sparkles } from "lucide-react";
import { AuthVideoBackground } from "@/components/store/auth-video-background";
import { getActiveSeason } from "@/server/catalog";
import { formatDateWIB } from "@/lib/dates";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const season = await getActiveSeason();

  return (
    <div className="auth-page">
      <AuthVideoBackground />
      <div className="auth-page__inner">
        <header className="auth-header">
          <Link href="/" className="auth-brand" aria-label="CipiSMP Store, kembali ke beranda">
            <Image src="/images/cipismp-logo.jpeg" alt="" width={48} height={48} className="auth-brand__logo" />
            <span><strong>CipiSMP<span className="text-[#f3b9d3]">.</span></strong><small>THE OFFICIAL STORE</small></span>
          </Link>
          <Link href="/" className="auth-back"><ArrowLeft size={15} aria-hidden /> <span>Kembali ke toko</span></Link>
        </header>

        <div className="auth-content">
          <aside className="auth-story" aria-label="Tentang CipiSMP Store">
            <div className="auth-story__tag"><span className="auth-story__dot" /> YOUR ADVENTURE STARTS HERE</div>
            <p className="auth-story__overline">A LITTLE WORLD, A LOT OF STORIES <Sparkles size={15} aria-hidden /></p>
            <h2>Tempat cerita<br /><em>barumu dimulai.</em></h2>
            <p className="auth-story__description">Dari petualangan pertama sampai momen favoritmu. Semua yang kamu butuhkan di CipiSMP, tersimpan dalam satu akun.</p>
            <div className="auth-story__divider" />
            <div className="auth-story__details">
              <div><span>01 / DUNIAMU</span><strong>Java &amp; Bedrock</strong></div>
              <div><span>02 / SEASON</span><strong>{season?.name ?? "Season baru"}</strong></div>
              <div><span>03 / CATATAN</span><strong>Rank, kit &amp; riwayat</strong></div>
            </div>
            <p className="auth-story__season">{season ? `Season berakhir ${formatDateWIB(season.endAt)}` : "Petualangan berikutnya segera hadir"} <ArrowUpRight size={14} aria-hidden /></p>
          </aside>

          <main id="konten" className="auth-main">
            <div className="auth-card">
              <div className="auth-card__ornament" aria-hidden="true"><span /><span /><span /></div>
              {children}
            </div>
            <footer className="auth-footer">
              <span>© CipiSMP Store</span>
              <div>
                <Link href="/legal/syarat-layanan">Syarat</Link>
                <span aria-hidden>·</span>
                <Link href="/legal/kebijakan-privasi">Privasi</Link>
                <span aria-hidden>·</span>
                <Link href="/legal/syarat-penjualan">Penjualan</Link>
              </div>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
