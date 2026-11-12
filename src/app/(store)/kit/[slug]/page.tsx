import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronDown, Layers } from "lucide-react";
import { ItemArt } from "@/components/art/item-art";
import { DetailNote, PerksCard, ProductBreadcrumb, PurchaseCard } from "@/components/store/product-detail";
import { ReviewSection } from "@/components/store/review-section";
import { getActiveSeason, getKitItemsForProducts, getProductBySlug } from "@/server/catalog";
import { getSettings } from "@/server/settings";
import { priceSingleProduct } from "@/server/pricing-service";
import { formatRp } from "@/lib/money";
import { isPurchaseFrozen } from "@/lib/seasons";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || product.type !== "KIT") return { title: "Kit tidak ditemukan" };
  return { title: product.name, description: `${product.tagline} ${formatRp(product.priceIdr)} per season di CipiSMP.`, alternates: { canonical: `/kit/${product.slug}` } };
}

export default async function KitDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || product.type !== "KIT" || product.status !== "PUBLISHED" || product.deletedAt) notFound();
  const [season, settings, items] = await Promise.all([getActiveSeason(), getSettings(), getKitItemsForProducts([product.id])]);
  const pricing = season ? await priceSingleProduct(product.id, `preview-${product.id}`, product.name) : null;
  const line = pricing?.result.lines[0];
  const basePayable = line?.unitPriceIdr ?? product.priceIdr;
  const autoDiscountApplied = pricing?.result.discountKind === "AUTOMATIC" && pricing.result.discountIdr > 0;
  const payable = autoDiscountApplied ? Math.max(0, basePayable - (pricing?.result.discountIdr ?? 0)) : basePayable;
  const frozen = season ? isPurchaseFrozen(season) : false;

  return (
    <div className="container-page py-8 lg:py-12">
      <ProductBreadcrumb type="kit" name={product.name} />
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,.85fr)] lg:gap-8">
        <div className="contents lg:block lg:min-w-0 lg:space-y-5">
          <article className="order-1 overflow-hidden rounded-[24px] border border-[#eadde6] bg-white shadow-card">
            <div className="grid sm:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
              <div className="relative flex min-h-[230px] items-center justify-center overflow-hidden bg-[#e7d7e8] p-7" aria-hidden>
                <div className="absolute inset-0 bg-[url('/images/gameplay/forest-path.webp')] bg-cover bg-center opacity-25" />
                <div className="relative grid w-full max-w-[230px] grid-cols-3 gap-2 rounded-[22px] border border-white/60 bg-white/55 p-4 shadow-card backdrop-blur-sm">{items.slice(0, 6).map((item) => <div key={item.id} className="grid aspect-square place-items-center rounded-xl border border-white/70 bg-white/70"><ItemArt itemKey={item.itemKey} className="size-9" title={item.name} /></div>)}</div>
              </div>
              <div className="flex flex-col justify-center p-6 sm:p-8"><p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#f3edf8] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.13em] text-[#79598f]"><Layers className="size-3" aria-hidden /> Kit musiman</p><h1 className="mt-4 break-words font-display text-[clamp(2.1rem,4vw,3rem)] leading-[1.05] tracking-[-.04em] text-ink">{product.name}<span className="text-accent">.</span></h1><p className="mt-3 text-[14px] leading-relaxed text-muted">{product.tagline}</p><div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full border border-line bg-[#fdf9fb] px-3 py-1.5 text-[11px] font-semibold text-muted">{product.maxPerSeason}× beli / pemain / season</span>{season ? <span className="rounded-full border border-line bg-[#fdf9fb] px-3 py-1.5 text-[11px] font-semibold text-muted">{season.name}</span> : null}</div></div>
            </div>
            <div className="border-t border-line px-6 py-5 sm:px-8"><p className="text-[13px] leading-relaxed text-muted">{product.description}</p></div>
          </article>
          <div className="order-3 min-w-0 space-y-5">
          <PerksCard perks={product.perks} />
          <section aria-labelledby="isi-kit" className="rounded-[22px] border border-line bg-white p-5 shadow-card sm:p-7"><p className="dashboard-kicker">INSIDE YOUR KIT</p><div className="mt-1 flex flex-wrap items-end justify-between gap-2"><h2 id="isi-kit" className="font-display text-[24px] text-ink">Isi kit<span className="text-accent">.</span></h2><p className="text-[11px] text-muted">{items.length} jenis item · buka kartu untuk detail</p></div>{items.length === 0 ? <p className="mt-5 rounded-2xl border border-dashed border-line p-5 text-[12px] text-muted">Belum ada rincian item untuk kit ini.</p> : <ul className="mt-5 grid items-start gap-2.5 sm:grid-cols-2">{items.map((item) => <li key={item.id}><details className="group rounded-2xl border border-[#f0e5ec] bg-[#fdf9fb] open:border-[#e5c9d9]"><summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl p-3.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden"><span className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-white"><ItemArt itemKey={item.itemKey} className="size-8" title="" /></span><span className="min-w-0 flex-1"><span className="block break-words text-[13px] font-semibold text-ink">{item.name}</span><span className="mt-0.5 block text-[11px] text-muted">{item.quantity} buah</span></span><ChevronDown className="size-4 shrink-0 text-muted-2 transition-transform group-open:rotate-180" aria-hidden /></summary><div className="border-t border-line px-4 py-3 text-[11.5px] leading-relaxed text-muted">{item.enchantments.length ? <ul className="space-y-1 text-accent-strong">{item.enchantments.map((ench, index) => <li key={`${ench}-${index}`}>{ench}</li>)}</ul> : null}{item.lore.length ? <ul className="mt-1 space-y-1">{item.lore.map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}</ul> : null}{!item.enchantments.length && !item.lore.length ? <p>Tidak ada detail tambahan.</p> : null}</div></details></li>)}</ul>}</section>
          <DetailNote title="Cara menggunakan kit"><ol className="space-y-2"><li>1. Setelah pembayaran terverifikasi, permission PlayerKits untuk kit ini dikirim otomatis.</li><li>2. Klaim reward di server lewat PlayerKits. Cooldown klaim diatur oleh server.</li><li>3. Akses berakhir saat season berakhir; kit dapat dibeli lagi di season berikutnya.</li></ol></DetailNote>
          </div>
        </div>
        <PurchaseCard productId={product.id} type="KIT" name={product.name} payable={payable} basePayable={basePayable} autoDiscountApplied={autoDiscountApplied} discountLabel={pricing?.result.discountLabel} season={season} frozen={frozen} giftingEnabled={settings.features.gifting} checkoutEnabled={settings.store.checkoutEnabled} />
      </div>
      <div className="mt-12 border-t border-line pt-10"><ReviewSection productId={product.id} productName={product.name} /></div>
    </div>
  );
}
