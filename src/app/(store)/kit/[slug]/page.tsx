import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Clock, Layers, ShieldCheck } from "lucide-react";
import { ItemArt } from "@/components/art/item-art";
import { AddToCart } from "@/components/store/add-to-cart";
import { ReviewSection } from "@/components/store/review-section";
import { Alert } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { ItemTooltip } from "@/components/ui/tooltip";
import { getActiveSeason, getKitItemsForProducts, getProductBySlug } from "@/server/catalog";
import { getSettings } from "@/server/settings";
import { priceSingleProduct } from "@/server/pricing-service";
import { formatRp } from "@/lib/money";
import { activeUntilLabel, isPurchaseFrozen } from "@/lib/seasons";
import { formatDateWIB } from "@/lib/dates";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || product.type !== "KIT") return { title: "Kit tidak ditemukan" };
  return {
    title: product.name,
    description: `${product.tagline} ${formatRp(product.priceIdr)} per season di CipiSMP.`,
    alternates: { canonical: `/kit/${product.slug}` },
  };
}

export default async function KitDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || product.type !== "KIT" || product.status !== "PUBLISHED" || product.deletedAt) notFound();

  const [season, settings] = await Promise.all([getActiveSeason(), getSettings()]);
  const giftingEnabled = settings.features.gifting;
  const items = await getKitItemsForProducts([product.id]);
  const pricing = season ? await priceSingleProduct(product.id, `preview-${product.id}`, product.name) : null;
  const line = pricing?.result.lines[0];
  const basePayable = line?.unitPriceIdr ?? product.priceIdr;
  const autoDiscountApplied = pricing?.result.discountKind === "AUTOMATIC" && pricing.result.discountIdr > 0;
  const payable = autoDiscountApplied ? Math.max(0, basePayable - (pricing?.result.discountIdr ?? 0)) : basePayable;
  const frozen = season ? isPurchaseFrozen(season) : false;

  return (
    <div className="container-page py-10 lg:py-14">
      <nav aria-label="Breadcrumb" className="text-[12.5px] text-muted-2">
        <Link href="/" className="hover:text-ink">Beranda</Link>
        <span aria-hidden> / </span>
        <Link href="/kit" className="hover:text-ink">Kit</Link>
        <span aria-hidden> / </span>
        <span className="text-muted">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.55fr_1fr] lg:gap-14">
        <div>
          <p className="eyebrow">Kit musiman</p>
          <h1 className="mt-1.5 font-display text-h1 text-ink">{product.name}</h1>
          <p className="mt-2 max-w-xl text-pretty text-[15px] leading-relaxed text-muted">{product.tagline}</p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Badge tone="neutral">
              <Layers className="size-2.5" aria-hidden />
              {product.maxPerSeason}× pembelian per pemain setiap season
            </Badge>
            {season ? <Badge tone="accent">{season.name}</Badge> : null}
          </div>

          <div className="mt-6 max-w-2xl text-[14.5px] leading-relaxed text-muted">
            <p>{product.description}</p>
          </div>

          <section aria-labelledby="isi-kit" className="mt-9">
            <div className="flex items-baseline justify-between">
              <h2 id="isi-kit" className="font-display text-h3 text-ink">Isi kit</h2>
              <span className="text-2xs text-muted-2">{items.length} jenis item · arahkan untuk detail</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {items.map((item) => (
                <ItemTooltip
                  key={item.id}
                  title={`${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`}
                  lines={item.lore}
                  enchantments={item.enchantments}
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-md border border-line bg-surface/70 p-2.5 text-left transition-colors duration-150 hover:border-line-strong hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-[6px] border border-line/80 bg-bg/60">
                      <ItemArt itemKey={item.itemKey} className="size-7" title={item.name} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] text-ink">{item.name}</span>
                      <span className="block text-2xs text-muted-2">
                        {item.quantity > 1 ? `${item.quantity} buah` : "1 buah"}
                        {item.enchantments.length > 0 ? ` · ${item.enchantments[0]}` : ""}
                      </span>
                    </span>
                  </button>
                </ItemTooltip>
              ))}
            </div>
          </section>

          <section className="mt-9 rounded-lg border border-line bg-surface/50 p-5">
            <h2 className="font-display text-[15px] text-ink">Cara pengambilan</h2>
            <ol className="mt-3 space-y-2 text-[13.5px] leading-relaxed text-muted">
              <li>1. Setelah pembayaran terverifikasi, permission PlayerKits untuk kit ini aktif otomatis.</li>
              <li>2. Klaim reward di server lewat PlayerKits; cooldown klaim 5 jam diatur di server.</li>
              <li>3. Akses berakhir saat season ini berakhir. Kit dapat dibeli lagi di season berikutnya.</li>
            </ol>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="surface-card p-5">
            <p className="text-2xs uppercase tracking-wider text-muted-2">Harga</p>
            <p className="mt-1 font-display text-[34px] leading-none text-ink">{formatRp(payable)}</p>
            {autoDiscountApplied ? (
              <p className="mt-1 text-[12px] text-muted-2">
                Sebelum promo: <span className="line-through">{formatRp(basePayable)}</span>
              </p>
            ) : null}
            <p className="mt-1 text-[12.5px] text-muted">
              {autoDiscountApplied
                ? `Perkiraan promo otomatis${pricing?.result.discountLabel ? ` “${pricing.result.discountLabel}”` : ""}; harga akhir dihitung di checkout.`
                : "Sekali beli memberi akses PlayerKits sampai season berakhir."}
            </p>

            {season ? (
              <p className="mt-4 flex items-start gap-2 border-t border-line pt-3 text-[12.5px] leading-relaxed text-muted">
                <Clock className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
                <span>{activeUntilLabel(season)}</span>
              </p>
            ) : null}

            <div className="mt-5">
              {frozen ? (
                <Alert tone="warning" title="Pembelian ditutup">
                  Pembelian ditutup pada {season?.freezeDays ?? 3} hari terakhir season
                  {season ? ` (${formatDateWIB(season.endAt)})` : ""}.
                </Alert>
              ) : (
                <AddToCart productId={product.id} label="Tambah ke keranjang" giftingEnabled={giftingEnabled} />
              )}
            </div>

            <div className="mt-5 space-y-2 border-t border-line pt-4 text-2xs leading-relaxed text-muted-2">
              <p className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                Pembelian bersifat final dan tidak dapat direfund.
              </p>
              <p>Isi kit dapat berubah antar season; yang dibeli adalah isi yang tampil saat pembelian.</p>
            </div>
          </div>
        </aside>
      </div>

      <ReviewSection productId={product.id} productName={product.name} />
    </div>
  );
}
