import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Check, Clock, Info, ShieldCheck } from "lucide-react";
import { RankBadge } from "@/components/art/item-art";
import { AddToCart } from "@/components/store/add-to-cart";
import { Alert } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { getActiveSeason, getProductBySlug } from "@/server/catalog";
import { getViewer } from "@/server/auth/guard";
import { verifiedProfilesForUser } from "@/server/minecraft";
import { priceSingleProduct } from "@/server/pricing-service";
import { formatRp } from "@/lib/money";
import { activeUntilLabel, isPurchaseFrozen } from "@/lib/seasons";
import { formatDateWIB } from "@/lib/dates";

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

  const season = await getActiveSeason();
  const viewer = await getViewer();
  const profiles = viewer ? await verifiedProfilesForUser(viewer.user.id) : [];
  const profile = profiles[0] ?? null;
  const pricing = profile && season ? await priceSingleProduct(product.id, profile.uuid, profile.displayName) : null;
  const line = pricing?.result.lines[0];
  const blocked = pricing?.result.errors.find((e) =>
    ["RANK_ALREADY_OWNED", "RANK_DOWNGRADE", "SEASON_FROZEN"].includes(e.code),
  );
  const frozen = season ? isPurchaseFrozen(season) : false;
  const payable = line?.unitPriceIdr ?? product.priceIdr;

  return (
    <div className="container-page py-10 lg:py-14">
      <nav aria-label="Breadcrumb" className="text-[12.5px] text-muted-2">
        <Link href="/" className="hover:text-ink">Beranda</Link>
        <span aria-hidden> / </span>
        <Link href="/rank" className="hover:text-ink">Rank</Link>
        <span aria-hidden> / </span>
        <span className="text-muted">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.55fr_1fr] lg:gap-14">
        <div>
          <div className="flex items-start gap-5">
            <RankBadge accent={product.accent} label={product.name.slice(0, 3)} size={88} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="eyebrow">Rank tier {product.tier}</p>
                {season ? <Badge tone="neutral">{season.name}</Badge> : null}
              </div>
              <h1 className="mt-1.5 font-display text-h1 text-ink">{product.name}</h1>
              <p className="mt-1.5 max-w-lg text-pretty text-[15px] leading-relaxed text-muted">{product.tagline}</p>
            </div>
          </div>

          <div className="mt-8 max-w-2xl space-y-4 text-[14.5px] leading-relaxed text-muted">
            <p>{product.description}</p>
          </div>

          <section aria-labelledby="perks" className="mt-10">
            <h2 id="perks" className="font-display text-h3 text-ink">Yang kamu dapat</h2>
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {product.perks.map((perk) => (
                <li key={perk} className="flex items-start gap-2.5 rounded-md border border-line bg-surface/60 px-3.5 py-3 text-[13.5px] text-ink">
                  <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                  {perk}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="aturan" className="mt-10 rounded-lg border border-line bg-surface/50 p-5">
            <h2 id="aturan" className="font-display text-[15px] text-ink">Aturan rank</h2>
            <ul className="mt-3 space-y-2 text-[13.5px] leading-relaxed text-muted">
              <li>• Satu pemain hanya bisa memegang satu rank per season.</li>
              <li>• Upgrade ke tier lebih tinggi hanya membayar selisih harga.</li>
              <li>• Membeli tier di bawah rank yang sedang aktif akan ditolak sistem.</li>
              <li>• Rank tidak memberi keuntungan PvP, damage, atau speed.</li>
            </ul>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="surface-card p-5">
            <p className="text-2xs uppercase tracking-wider text-muted-2">Harga</p>
            <p className="mt-1 font-display text-[34px] leading-none text-ink">
              {formatRp(payable)}
            </p>
            {line?.upgradeFrom ? (
              <p className="mt-2 rounded-md border border-accent/25 bg-accent/10 px-3 py-2 text-[12.5px] leading-relaxed text-accent">
                Upgrade dari {line.upgradeFrom.name}: kamu hanya membayar selisih {formatRp(line.unitPriceIdr)}.
              </p>
            ) : (
              <p className="mt-1 text-[12.5px] text-muted">Sekali bayar untuk season ini.</p>
            )}

            {season ? (
              <p className="mt-4 flex items-start gap-2 border-t border-line pt-3 text-[12.5px] leading-relaxed text-muted">
                <Clock className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
                <span>
                  <strong className="font-medium text-ink">{activeUntilLabel(season)}</strong>
                  <br />
                  Rank tidak diperpanjang otomatis dan harus dibeli lagi di season berikutnya.
                </span>
              </p>
            ) : null}

            <div className="mt-5">
              {blocked ? (
                <Alert tone="warning" title={blocked.code === "RANK_ALREADY_OWNED" ? "Sudah dimiliki" : "Tidak tersedia"}>
                  {blocked.message}
                </Alert>
              ) : frozen ? (
                <Alert tone="warning" title="Pembelian ditutup">
                  Pembelian ditutup pada {season?.freezeDays ?? 3} hari terakhir season
                  {season ? ` (${formatDateWIB(season.endAt)})` : ""}.
                </Alert>
              ) : (
                <AddToCart productId={product.id} label="Tambah ke keranjang" />
              )}
            </div>

            {!profile ? (
              <p className="mt-3 flex items-start gap-2 text-2xs leading-relaxed text-muted-2">
                <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
                Masuk dan hubungkan akun Minecraft untuk melihat harga upgrade personal.
              </p>
            ) : null}

            <div className="mt-5 space-y-2 border-t border-line pt-4 text-2xs leading-relaxed text-muted-2">
              <p className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                Pembelian bersifat final. Tidak ada refund, termasuk bila akun kemudian melanggar aturan server.
              </p>
              <p>Pembayaran: QRIS, virtual account, GoPay, OVO, DANA, ShopeePay.</p>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-line p-4 text-[12.5px] leading-relaxed text-muted">
            <p className="font-medium text-ink">Butuh tier lain?</p>
            <div className="mt-2 flex gap-2">
              <Link href="/rank" className="text-accent hover:underline">Bandingkan tier</Link>
              <span className="text-line-strong" aria-hidden>·</span>
              <Link href="/faq" className="hover:text-ink">Baca FAQ</Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
