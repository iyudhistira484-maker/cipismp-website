import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { RankBadge } from "@/components/art/item-art";
import { DetailNote, PerksCard, ProductBreadcrumb, PurchaseCard } from "@/components/store/product-detail";
import { ReviewSection } from "@/components/store/review-section";
import { getActiveSeason, getProductBySlug } from "@/server/catalog";
import { getSettings } from "@/server/settings";
import { getViewer } from "@/server/auth/guard";
import { verifiedProfilesForUser } from "@/server/minecraft";
import { priceSingleProduct } from "@/server/pricing-service";
import { formatRp } from "@/lib/money";
import { isPurchaseFrozen } from "@/lib/seasons";
import { getProductArtwork } from "@/lib/product-artwork";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || product.type !== "RANK") return { title: "Rank tidak ditemukan" };
  return {
    title: `Rank ${product.name}`,
    description: `${product.tagline} Mulai ${formatRp(product.priceIdr)} per season di CipiSMP.`,
    alternates: { canonical: `/rank/${product.slug}` },
  };
}

export default async function RankDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || product.type !== "RANK" || product.status !== "PUBLISHED" || product.deletedAt) notFound();

  const [season, settings] = await Promise.all([getActiveSeason(), getSettings()]);
  const giftingEnabled = settings.features.gifting;
  const viewer = await getViewer();
  const profiles = viewer ? await verifiedProfilesForUser(viewer.user.id) : [];
  const profile = profiles[0] ?? null;
  const pricing = season
    ? await priceSingleProduct(product.id, profile?.uuid ?? `preview-${product.id}`, profile?.displayName ?? product.name)
    : null;
  const line = pricing?.result.lines[0];
  const basePayable = line?.unitPriceIdr ?? product.priceIdr;
  const autoDiscountApplied = pricing?.result.discountKind === "AUTOMATIC" && pricing.result.discountIdr > 0;
  const payable = autoDiscountApplied
    ? Math.max(0, basePayable - (pricing?.result.discountIdr ?? 0))
    : basePayable;
  const blocked = pricing?.result.errors.find((e) =>
    ["RANK_ALREADY_OWNED", "RANK_DOWNGRADE", "SEASON_FROZEN"].includes(e.code),
  );
  const frozen = season ? isPurchaseFrozen(season) : false;

  const artwork = getProductArtwork(product.slug, product.artwork);

  return (
    <div className="container-page py-8 lg:py-12">
      <ProductBreadcrumb type="rank" name={product.name} />
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,.85fr)] lg:gap-8">
        <div className="contents lg:block lg:min-w-0 lg:space-y-5">
          <article className="order-1 overflow-hidden rounded-[24px] border border-[#eadde6] bg-white shadow-card">
            <div className="grid sm:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
              <div className="relative isolate flex min-h-[240px] items-end overflow-hidden bg-[#50394a] p-5 sm:min-h-[320px]" aria-hidden>
                {artwork ? <Image src={artwork} alt="" fill sizes="(min-width: 1024px) 400px, (min-width: 640px) 45vw, 100vw" className="-z-10 object-cover" priority /> : <div className="absolute inset-0 -z-10 bg-[url('/images/gameplay/forest-path.webp')] bg-cover bg-center" />}
                <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#30202e]/80 via-[#443240]/10 to-transparent" />
                <span className="rounded-2xl border border-white/30 bg-white/80 p-2 backdrop-blur-sm"><RankBadge accent={product.accent} label={product.name.slice(0, 3)} size={64} /></span>
              </div>
              <div className="flex flex-col justify-center p-6 sm:p-8"><p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#f9edf4] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.13em] text-accent-strong"><Sparkles className="size-3" aria-hidden /> Rank tier {product.tier}</p><h1 className="mt-4 break-words font-display text-[clamp(2.1rem,4vw,3rem)] leading-[1.05] tracking-[-.04em] text-ink">{product.name}<span className="text-accent">.</span></h1><p className="mt-3 text-[14px] leading-relaxed text-muted">{product.tagline}</p>{season ? <p className="mt-5 w-fit rounded-full border border-line bg-[#fdf9fb] px-3 py-1.5 text-[11px] font-semibold text-muted">{season.name}</p> : null}</div>
            </div>
            <div className="border-t border-line px-6 py-5 sm:px-8"><p className="text-[13px] leading-relaxed text-muted">{product.description}</p></div>
          </article>
          <div className="order-3 min-w-0 space-y-5">
          <PerksCard perks={product.perks} />
          <DetailNote title="Sebelum memilih rank"><ul className="space-y-2"><li>• Satu pemain hanya bisa memegang satu rank per season.</li><li>• Upgrade ke tier lebih tinggi hanya membayar selisih harga.</li><li>• Membeli tier di bawah rank yang sedang aktif akan ditolak sistem.</li></ul></DetailNote>
          </div>
        </div>
        <PurchaseCard productId={product.id} type="RANK" name={product.name} payable={payable} basePayable={basePayable} autoDiscountApplied={autoDiscountApplied} discountLabel={pricing?.result.discountLabel} upgradeFrom={line?.upgradeFrom?.name} season={season} frozen={frozen} giftingEnabled={giftingEnabled} checkoutEnabled={settings.store.checkoutEnabled} blocked={blocked} hasProfile={Boolean(profile)} />
      </div>
      <div className="mt-12 border-t border-line pt-10"><ReviewSection productId={product.id} productName={product.name} /></div>
    </div>
  );
}
