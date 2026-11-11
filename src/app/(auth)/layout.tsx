import Link from "next/link";
import { Logo } from "@/components/art/item-art";
import { RankBadge } from "@/components/art/item-art";
import { getActiveSeason } from "@/server/catalog";
import { formatDateWIB } from "@/lib/dates";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const season = await getActiveSeason();

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Panel brand: hanya di desktop, dengan komposisi editorial */}
      <aside className="hidden flex-col justify-between border-r border-line bg-surface-2 p-10 lg:flex xl:p-14">
        <Link href="/" className="relative">
          <Logo />
        </Link>

        <div className="relative max-w-md">
          <div className="flex items-end gap-3">
            <RankBadge accent="cute" label="S1" size={54} />
            <div>
              <p className="eyebrow">{season?.name ?? "Season baru"}</p>
              <p className="mt-1 text-[13px] text-muted">
                {season ? `Berakhir ${formatDateWIB(season.endAt)}` : "Segera dibuka"}
              </p>
            </div>
          </div>
          <h2 className="mt-7 text-balance font-display text-[34px] leading-[1.05] tracking-[-0.02em] text-ink">
            Satu akun untuk rank, kit, dan riwayat pembelianmu.
          </h2>
          <p className="mt-4 text-pretty text-[14px] leading-relaxed text-muted">
            Akun menyimpan tautan akun Minecraft, kuitansi, dan status pengiriman. Checkout tanpa akun
            tetap bisa, tapi dengan akun semuanya tersimpan di satu tempat.
          </p>

          <ul className="mt-8 space-y-3 border-t border-line pt-6 text-[13px] text-muted">
            <li className="flex gap-2.5">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent/70" aria-hidden />
              Rank dan kit aktif sampai akhir season — tercatat jelas di dashboard.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent/70" aria-hidden />
              Item dikirim otomatis; kalau kamu offline, menunggu sampai login berikutnya.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent/70" aria-hidden />
              Tidak ada tagihan berulang. Tidak ada data pembayaran yang kami simpan.
            </li>
          </ul>
        </div>

        <p className="relative font-mono text-[10px] uppercase tracking-[0.12em] text-muted-2">
          cipismp.my.id · Java 25565 · Bedrock 19202
        </p>
      </aside>

      <main className="flex flex-col">
        <div className="flex items-center justify-between border-b border-line px-5 py-4 lg:hidden">
          <Link href="/"><Logo /></Link>
          <Link href="/" className="text-[12.5px] text-muted hover:text-ink">Kembali ke toko</Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-12 sm:px-8">
          <div className="w-full max-w-[27rem]">{children}</div>
        </div>
        <div className="px-5 pb-8 text-center text-2xs text-muted-2 sm:px-8">
          <Link href="/legal/syarat-layanan" className="hover:text-ink">Syarat Layanan</Link>
          <span className="mx-2" aria-hidden>·</span>
          <Link href="/legal/kebijakan-privasi" className="hover:text-ink">Kebijakan Privasi</Link>
          <span className="mx-2" aria-hidden>·</span>
          <Link href="/legal/syarat-penjualan" className="hover:text-ink">Syarat Penjualan</Link>
        </div>
      </main>
    </div>
  );
}
