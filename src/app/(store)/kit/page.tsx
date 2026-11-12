import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CalendarDays, Clock3, PackageCheck, ShieldCheck } from "lucide-react";
import { KitCard } from "@/components/store/product-cards";
import { CatalogEmpty, CatalogHero, CatalogToolbar } from "@/components/store/catalog-layout";
import { Alert } from "@/components/ui/feedback";
import { getActiveSeason, getKitItemsForProducts, getPublishedProducts } from "@/server/catalog";
import { ratingMap } from "@/server/reviews";
import { isPurchaseFrozen } from "@/lib/seasons";

export const metadata: Metadata = {
  title: "Kit",
  description: "CipiPrime dan Cipi++: akses PlayerKits satu season, dibeli sekali per pemain dan dapat diklaim dengan cooldown 5 jam.",
  alternates: { canonical: "/kit" },
};

export default async function KitListPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const [all, season] = await Promise.all([getPublishedProducts("KIT"), getActiveSeason()]);
  const ratings = await ratingMap(all.map((kit) => kit.id));
  const items = await getKitItemsForProducts(all.map((kit) => kit.id));
  const itemsByProduct = new Map<string, typeof items>();
  for (const item of items) {
    const list = itemsByProduct.get(item.productId) ?? [];
    list.push(item);
    itemsByProduct.set(item.productId, list);
  }
  const query = q.trim().toLowerCase();
  const kits = query ? all.filter((kit) => kit.name.toLowerCase().includes(query) || kit.tagline.toLowerCase().includes(query) || (itemsByProduct.get(kit.id) ?? []).some((item) => item.name.toLowerCase().includes(query))) : all;
  const frozen = season ? isPurchaseFrozen(season) : false;

  return (
    <div className="container-page space-y-8 py-8 lg:space-y-10 lg:py-12">
      <CatalogHero type="kit" season={season} count={all.length} />
      {frozen && season ? <Alert tone="warning" title="Pembelian sedang ditutup">Pembelian ditutup pada {season.freezeDays} hari terakhir season. Akses kit yang sudah dibeli tetap aktif dan dapat diklaim melalui PlayerKits sampai season berakhir.</Alert> : null}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-8">
        <section id="katalog" aria-labelledby="catalog-heading" className="min-w-0 scroll-mt-24">
          <CatalogToolbar type="kit" query={q} count={kits.length} />
          {kits.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2">{kits.map((kit) => <KitCard key={kit.id} product={kit} items={itemsByProduct.get(kit.id) ?? []} season={season ? { name: season.name, endAt: season.endAt } : null} rating={ratings.get(kit.id)} />)}</div> : <CatalogEmpty type="kit" query={q} />}
        </section>
        <aside aria-label="Informasi kit" className="space-y-4 lg:sticky lg:top-24">
          <section className="rounded-[22px] border border-[#eadbe7] bg-[#fcf4f9] p-5 sm:p-6"><span className="grid size-11 place-items-center rounded-2xl bg-white text-accent-strong shadow-sm"><PackageCheck className="size-5" aria-hidden /></span><p className="mt-5 text-[10px] font-bold uppercase tracking-[.14em] text-accent-strong">Kenali kit-mu</p><h2 className="mt-1 font-display text-[20px] leading-tight text-ink">Pilih dengan tenang.</h2><p className="mt-2 text-[12.5px] leading-relaxed text-muted">Lihat isi, jumlah item, dan batas pembelian pada detail setiap kit sebelum checkout.</p><Link href="/cara-kerja" className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-accent-strong hover:underline">Cara kerja <ArrowRight className="size-3.5" aria-hidden /></Link></section>
          <section className="rounded-[22px] border border-line bg-white p-5 sm:p-6"><ul className="space-y-4"><li className="flex items-start gap-3"><CalendarDays className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden /><div><h3 className="text-[12.5px] font-semibold text-ink">Akses per season</h3><p className="mt-1 text-[12px] leading-relaxed text-muted">Akses PlayerKits berlaku sampai akhir season.</p></div></li><li className="flex items-start gap-3"><Clock3 className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden /><div><h3 className="text-[12.5px] font-semibold text-ink">Cooldown klaim</h3><p className="mt-1 text-[12px] leading-relaxed text-muted">Klaim ulang mengikuti cooldown 5 jam yang diatur server.</p></div></li><li className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden /><div><h3 className="text-[12.5px] font-semibold text-ink">Pembayaran terverifikasi</h3><p className="mt-1 text-[12px] leading-relaxed text-muted">Akses diproses otomatis setelah pembayaran terkonfirmasi dan pemain siap.</p></div></li></ul></section>
        </aside>
      </div>
    </div>
  );
}
