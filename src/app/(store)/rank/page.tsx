import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CalendarDays, CircleHelp, TrendingUp } from "lucide-react";
import { RankCard } from "@/components/store/product-cards";
import { CatalogEmpty, CatalogHero, CatalogToolbar } from "@/components/store/catalog-layout";
import { Alert } from "@/components/ui/feedback";
import { getActiveSeason, getPublishedProducts } from "@/server/catalog";
import { ratingMap } from "@/server/reviews";
import { isPurchaseFrozen } from "@/lib/seasons";
import { formatDateWIB } from "@/lib/dates";
import { formatRp } from "@/lib/money";

export const metadata: Metadata = {
  title: "Rank",
  description: "Pilih rank CipiSMP untuk season ini. Lihat keuntungan, harga, dan masa aktif setiap tier sebelum membeli.",
  alternates: { canonical: "/rank" },
};

export default async function RankListPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const [all, season] = await Promise.all([getPublishedProducts("RANK"), getActiveSeason()]);
  const ratings = await ratingMap(all.map((rank) => rank.id));
  const query = q.trim().toLowerCase();
  const ranks = query ? all.filter((rank) => rank.name.toLowerCase().includes(query) || rank.tagline.toLowerCase().includes(query) || rank.perks.some((perk) => perk.toLowerCase().includes(query))) : all;
  const frozen = season ? isPurchaseFrozen(season) : false;
  const perks = Array.from(new Set(all.flatMap((rank) => rank.perks).filter((perk) => !/^semua (fitur|keuntungan)/i.test(perk))));

  return (
    <div className="container-page space-y-8 py-8 lg:space-y-10 lg:py-12">
      <CatalogHero type="rank" season={season} count={all.length} />
      {frozen && season ? <Alert tone="warning" title="Pembelian sedang ditutup">Pembelian ditutup pada {season.freezeDays} hari terakhir season ({formatDateWIB(season.endAt)}). Rank yang ada tetap aktif sampai season berakhir.</Alert> : null}
      <section id="katalog" aria-labelledby="catalog-heading" className="scroll-mt-24">
        <CatalogToolbar type="rank" query={q} count={ranks.length} />
        {ranks.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{ranks.map((rank) => <RankCard key={rank.id} product={rank} season={season ? { name: season.name, endAt: season.endAt } : null} rating={ratings.get(rank.id)} />)}</div> : <CatalogEmpty type="rank" query={q} />}
      </section>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-[20px] border border-line bg-white p-5"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#faeaf2] text-accent-strong"><TrendingUp className="size-5" aria-hidden /></span><div><h2 className="font-display text-[16px] text-ink">Mau upgrade?</h2><p className="mt-1 text-[12.5px] leading-relaxed text-muted">Untuk upgrade yang memenuhi syarat, harga rank yang sudah dimiliki diperhitungkan. Harga akhir dihitung saat checkout.</p></div></div>
        <div className="flex items-start gap-3 rounded-[20px] border border-line bg-white p-5"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f2ecfa] text-[#8963a1]"><CalendarDays className="size-5" aria-hidden /></span><div><h2 className="font-display text-[16px] text-ink">Berlaku per season</h2><p className="mt-1 text-[12.5px] leading-relaxed text-muted">Rank berlaku hingga akhir season dan tidak diperpanjang otomatis.</p></div></div>
      </div>
      {all.length ? <section aria-labelledby="comparison-heading" className="rounded-[22px] border border-line bg-white p-5 shadow-card sm:p-7"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Bandingkan pilihanmu</p><h2 id="comparison-heading" className="mt-1 font-display text-[25px] text-ink">Perbandingan tier<span className="text-accent">.</span></h2><p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-muted">Tabel ini menampilkan keuntungan yang tercantum langsung pada tiap rank. Tanda — berarti tidak tercantum secara terpisah, bukan berarti pasti tidak termasuk; baca detail tiap rank untuk fitur yang diwarisi.</p></div><span className="text-[11px] text-muted-2">Geser tabel ke samping di layar kecil →</span></div><div role="region" aria-label="Tabel perbandingan rank, dapat digeser" tabIndex={0} className="mt-5 overflow-x-auto rounded-2xl border border-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"><table className="w-full min-w-[560px] border-collapse text-left text-[12.5px]"><thead><tr className="border-b border-line bg-[#fcf5f9]"><th scope="col" className="px-4 py-3 font-semibold text-muted">Keuntungan tercantum</th>{all.map((rank) => <th key={rank.id} scope="col" className="px-4 py-3 text-center font-semibold text-ink">{rank.name}</th>)}</tr></thead><tbody>{perks.map((perk) => <tr key={perk} className="border-b border-line/60 last:border-0"><th scope="row" className="px-4 py-3 text-left font-normal text-muted">{perk}</th>{all.map((rank) => <td key={rank.id} className="px-4 py-3 text-center">{rank.perks.includes(perk) ? <span className="font-bold text-accent-strong" aria-label="Tercantum">●</span> : <span className="text-muted-2" aria-label="Tidak tercantum secara terpisah">—</span>}</td>)}</tr>)}<tr className="bg-[#fcf5f9]"><th scope="row" className="px-4 py-3 text-left font-semibold text-ink">Harga per season</th>{all.map((rank) => <td key={rank.id} className="whitespace-nowrap px-4 py-3 text-center font-semibold text-ink">{formatRp(rank.priceIdr)}</td>)}</tr></tbody></table></div></section> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[#ebdce9] bg-[#f9f4f9] p-5"><div className="flex items-start gap-3"><CircleHelp className="mt-0.5 size-5 shrink-0 text-accent-strong" aria-hidden /><div><h2 className="font-display text-[16px] text-ink">Masih ingin tahu lebih banyak?</h2><p className="mt-1 text-[12px] leading-relaxed text-muted">Baca panduan sebelum memilih dan membeli.</p></div></div><Link href="/faq" className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent-strong hover:underline">Lihat FAQ <ArrowRight className="size-3.5" aria-hidden /></Link></div>
    </div>
  );
}
