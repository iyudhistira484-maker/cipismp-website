import Image from "next/image";
import { ArrowUpRight, Clock, Layers } from "lucide-react";
import type { Product } from "@/server/db/schema";
import type { KitItem } from "@/server/db/schema";
import { ItemArt, RankBadge } from "@/components/art/item-art";
import { Badge } from "@/components/ui/badge";
import { ItemTooltip } from "@/components/ui/tooltip";
import { formatRp } from "@/lib/money";
import { activeUntilLabel } from "@/lib/seasons";
import { cn } from "@/lib/utils";
import { RatingInline } from "@/components/ui/stars";
import { getProductArtwork } from "@/lib/product-artwork";

// Use document navigation: catalog client-router transitions can stall in production.
export function RankCard({
  product,
  season,
  highlighted = false,
  rating,
}: {
  product: Product;
  season: { name: string; endAt: Date } | null;
  highlighted?: boolean;
  rating?: { count: number; average: number };
}) {
  const artwork = getProductArtwork(product.slug, product.artwork);

  return (
    <article
      className={cn(
        "group premium-card-3d relative flex flex-col overflow-hidden rounded-xl border bg-white hover:border-accent/40",
        highlighted ? "border-accent/40" : "border-line",
      )}
    >
      {highlighted ? (
        <span className="absolute right-4 top-4 z-10 rounded-full bg-accent px-2 py-0.5 text-2xs font-semibold text-accent-ink shadow-pop">
          Paling seimbang
        </span>
      ) : null}
      {artwork ? (
        <div className="relative aspect-[16/10] overflow-hidden border-b border-line/70 bg-bg">
          <Image
            src={artwork}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg/80 via-bg/5 to-transparent" />
          <div className="absolute bottom-3 left-4">
            <RankBadge accent={product.accent} label={product.name.slice(0, 3)} size={54} />
          </div>
        </div>
      ) : null}
      <div className="relative overflow-hidden border-b border-line/70 px-5 pb-5 pt-4">
        {!artwork ? <RankBadge accent={product.accent} label={product.name.slice(0, 3)} size={62} /> : null}
        <h3 className={cn("font-display text-[22px] leading-tight text-ink", !artwork && "mt-4")}>{product.name}</h3>
        <p className="mt-1.5 min-h-[40px] text-pretty text-[13px] leading-relaxed text-muted">{product.tagline}</p>
        {rating && rating.count > 0 ? (
          <div className="mt-2">
            <RatingInline count={rating.count} average={rating.average} />
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="font-display text-[26px] leading-none text-ink">
          {formatRp(product.priceIdr)}
          <span className="ml-1.5 text-[12px] font-normal text-muted">per season</span>
        </p>
        <ul className="mt-4 flex-1 space-y-2">
          {product.perks.slice(0, 4).map((perk) => (
            <li key={perk} className="flex items-start gap-2 text-[13px] leading-relaxed text-muted">
              <span className="mt-[7px] size-1 shrink-0 rounded-full bg-accent/70" aria-hidden />
              {perk}
            </li>
          ))}
          {product.perks.length > 4 ? (
            <li className="pl-3 text-2xs text-muted-2">+{product.perks.length - 4} keuntungan lain</li>
          ) : null}
        </ul>

        {season ? (
          <p className="mt-4 flex items-start gap-1.5 border-t border-line/70 pt-3 text-2xs leading-relaxed text-muted-2">
            <Clock className="mt-px size-3 shrink-0" aria-hidden />
            {activeUntilLabel(season)}
          </p>
        ) : null}

        <a
          href={`/rank/${product.slug}`}
          className="mt-4 inline-flex h-10 items-center justify-between rounded-md border border-line-strong bg-bg/40 px-3.5 text-[13px] font-medium text-ink transition-colors duration-150 hover:border-accent/50 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          Lihat detail
          <ArrowUpRight className="size-4" aria-hidden />
        </a>
      </div>
    </article>
  );
}

export function KitCard({
  product,
  items,
  season,
  rating,
}: {
  product: Product;
  items: KitItem[];
  season: { name: string; endAt: Date } | null;
  rating?: { count: number; average: number };
}) {
  const itemPreviewCount = 8;

  return (
    <article className="group premium-card-3d flex flex-col overflow-hidden rounded-xl border border-line bg-white hover:border-accent/40">
      <div className="border-b border-line/70 bg-bg/40 p-4">
        <div className="grid grid-cols-4 gap-2" aria-hidden>
          {items.slice(0, itemPreviewCount).map((item) => (
            <div
              key={item.id}
              className="grid aspect-square place-items-center rounded-[6px] border border-line/80 bg-surface-2/60 transition-colors group-hover:border-line-strong"
            >
              <ItemArt itemKey={item.itemKey} className="size-7" title={item.name} />
            </div>
          ))}
        </div>
        {items.length > itemPreviewCount ? (
          <p className="mt-2 text-2xs text-muted-2">+{items.length - itemPreviewCount} item lain</p>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-[19px] leading-tight text-ink">{product.name}</h3>
          <Badge tone="neutral" className="mt-0.5 shrink-0">
            <Layers className="size-2.5" aria-hidden />
            {product.maxPerSeason}× beli/season
          </Badge>
        </div>
        <p className="mt-1.5 text-pretty text-[13px] leading-relaxed text-muted">{product.tagline}</p>
        {rating && rating.count > 0 ? (
          <div className="mt-2">
            <RatingInline count={rating.count} average={rating.average} />
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {items.slice(0, 3).map((item) => (
            <ItemTooltip
              key={item.id}
              title={`${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`}
              lines={item.lore}
              enchantments={item.enchantments}
            >
              <button
                type="button"
                className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-2xs text-muted transition-colors hover:border-accent/40 hover:text-accent"
              >
                {item.name}
              </button>
            </ItemTooltip>
          ))}
          {items.length > 3 ? <span className="px-1 py-0.5 text-2xs text-muted-2">+{items.length - 3}</span> : null}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <p className="font-display text-[22px] leading-none text-ink">{formatRp(product.priceIdr)}</p>
          <a
            href={`/kit/${product.slug}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-2 text-[12.5px] font-medium text-ink transition-colors hover:border-accent/50 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            Isi kit
            <ArrowUpRight className="size-3.5" aria-hidden />
          </a>
        </div>
        {season ? (
          <p className="mt-3 border-t border-line/70 pt-3 text-2xs leading-relaxed text-muted-2">
            {activeUntilLabel(season)}
          </p>
        ) : null}
      </div>
    </article>
  );
}
