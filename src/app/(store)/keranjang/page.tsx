import Link from "next/link";
import type { Metadata } from "next";
import { Trash2, ArrowRight } from "lucide-react";
import { getCartIdentity, getCartLines } from "@/server/cart";
import { getActiveSeason, getKitItemsForProducts, getPublishedProducts } from "@/server/catalog";
import { getSettings } from "@/server/settings";
import { ItemArt } from "@/components/art/item-art";
import { EmptyState } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { removeFromCartAction } from "@/app/actions/cart";
import { formatRp } from "@/lib/money";
import { activeUntilLabel, isPurchaseFrozen } from "@/lib/seasons";
import { formatDateWIB } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Keranjang",
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const [identity, season, settings] = await Promise.all([
    getCartIdentity(),
    getActiveSeason(),
    getSettings(),
  ]);
  const lines = await getCartLines(identity.cartId);
  const allProducts = await getPublishedProducts();
  const kitItems = await getKitItemsForProducts(allProducts.map((p) => p.id));
  const productById = new Map(allProducts.map((p) => [p.id, p]));
  const firstItemByProduct = new Map<string, string>();
  for (const item of kitItems) {
    if (!firstItemByProduct.has(item.productId)) firstItemByProduct.set(item.productId, item.itemKey);
  }

  const subtotal = lines.reduce(
    (sum, line) => sum + (productById.get(line.productId)?.priceIdr ?? 0) * line.quantity,
    0,
  );
  const frozen = season ? isPurchaseFrozen(season) : false;

  return (
    <div className="container-page py-12 lg:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Keranjang</p>
          <h1 className="mt-2 font-display text-h1 text-ink">Periksa pesananmu</h1>
        </div>
        <Link href="/rank" className="text-[13px] text-muted transition-colors hover:text-accent">
          Tambah rank atau kit lain
        </Link>
      </div>

      {lines.length === 0 ? (
        <EmptyState
          className="mt-10"
          title="Keranjang masih kosong"
          description="Pilih rank atau kit untuk season ini. Semua item berlaku sampai akhir season dan dikirim otomatis setelah pembayaran."
          action={
            <div className="flex gap-2">
              <Link href="/rank">
                <Button variant="primary">Lihat rank</Button>
              </Link>
              <Link href="/kit">
                <Button variant="secondary">Lihat kit</Button>
              </Link>
            </div>
          }
        />
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <div className="divide-y divide-line rounded-lg border border-line">
            {lines.map((line) => {
              const product = productById.get(line.productId);
              if (!product) return null;
              const artKey =
                product.type === "KIT"
                  ? (firstItemByProduct.get(product.id) ?? "map")
                  : product.accent === "diamond"
                    ? "compass"
                    : product.accent === "gold"
                      ? "lantern"
                      : "stone_sword";
              return (
                <div key={line.id} className="flex items-center gap-4 p-4 sm:p-5">
                  <div className="grid size-14 shrink-0 place-items-center rounded-md border border-line bg-bg/60">
                    <ItemArt itemKey={artKey} className="size-9" title={product.name} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h2 className="text-[15px] font-medium text-ink">{product.name}</h2>
                      <span className="text-2xs uppercase tracking-wider text-muted-2">
                        {product.type === "RANK" ? "Rank" : "Kit"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{product.tagline}</p>
                    {line.isGift && line.targetName ? (
                      <p className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10.5px] text-accent">
                        Hadiah untuk {line.targetName}
                      </p>
                    ) : null}
                    {season ? (
                      <p className="mt-1 text-2xs text-muted-2">{activeUntilLabel(season)}</p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="text-[15px] text-ink">{formatRp(product.priceIdr * line.quantity)}</p>
                    <form action={removeFromCartAction} className="mt-1.5">
                      <input type="hidden" name="itemId" value={line.id} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1 text-2xs text-muted-2 transition-colors hover:text-danger"
                      >
                        <Trash2 className="size-3" aria-hidden />
                        Hapus
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="surface-card p-5">
              <h2 className="font-display text-[16px] text-ink">Ringkasan</h2>
              <dl className="mt-4 space-y-2.5 text-[13.5px]">
                <div className="flex justify-between">
                  <dt className="text-muted">Subtotal</dt>
                  <dd className="text-ink">{formatRp(subtotal)}</dd>
                </div>
                {settings.store.taxPercent > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-muted">{settings.store.taxLabel} {settings.store.taxPercent}%</dt>
                    <dd className="text-muted">dihitung saat checkout</dd>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-line pt-2.5 text-[15px]">
                  <dt className="text-ink">Perkiraan total</dt>
                  <dd className="font-medium text-ink">{formatRp(subtotal)}</dd>
                </div>
              </dl>

              <p className="mt-3 text-2xs leading-relaxed text-muted-2">
                Harga upgrade (bila kamu sudah punya rank lebih rendah) dan kupon dihitung ulang di
                halaman checkout berdasarkan data server.
              </p>

              {frozen ? (
                <div className="mt-4 rounded-md border border-warning/30 bg-warning/10 p-3 text-[12.5px] leading-relaxed text-warning">
                  Pembelian ditutup pada {season?.freezeDays ?? 3} hari terakhir season
                  {season ? ` (${formatDateWIB(season.endAt)})` : ""}. Kamu masih bisa menyimpan keranjang,
                  tetapi checkout akan ditolak.
                </div>
              ) : (
                <Link href="/checkout" className="mt-4 block">
                  <Button size="lg" className="w-full">
                    Lanjut ke pembayaran
                    <ArrowRight className="size-4" aria-hidden />
                  </Button>
                </Link>
              )}

              <p className="mt-3 text-2xs leading-relaxed text-muted-2">
                Semua pembelian bersifat final dan tidak dapat direfund.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
