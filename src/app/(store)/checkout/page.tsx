import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCartIdentity, getCartLines } from "@/server/cart";
import { getActiveSeason, getPublishedProducts } from "@/server/catalog";
import { getAvailableProviders, defaultProvider } from "@/server/payments";
import { getSettings } from "@/server/settings";
import { getViewer } from "@/server/auth/guard";
import { verifiedProfilesForUser } from "@/server/minecraft";
import { isPurchaseFrozen } from "@/lib/seasons";
import { formatDateWIB } from "@/lib/dates";
import { CheckoutForm } from "@/components/store/checkout-form";
import { EmptyState, Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Pembayaran",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const [identity, season, settings, viewer] = await Promise.all([
    getCartIdentity(),
    getActiveSeason(),
    getSettings(),
    getViewer(),
  ]);
  const lines = await getCartLines(identity.cartId);
  if (lines.length === 0) redirect("/keranjang");

  const products = await getPublishedProducts();
  const cartProducts = lines
    .map((line) => {
      const product = products.find((p) => p.id === line.productId);
      return product ? { product, quantity: line.quantity } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const providers = await getAvailableProviders();
  const preferred = await defaultProvider(providers);
  const profiles = viewer ? await verifiedProfilesForUser(viewer.user.id) : [];
  const frozen = season ? isPurchaseFrozen(season) : false;

  return (
    <div className="container-page py-12 lg:py-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Checkout</p>
          <h1 className="mt-2 font-display text-h1 text-ink">Satu langkah lagi</h1>
        </div>
        <Link href="/keranjang" className="text-[13px] text-muted transition-colors hover:text-accent">
          Ubah keranjang
        </Link>
      </div>

      {frozen ? (
        <Alert tone="warning" className="mt-6" title="Pembelian ditutup sementara">
          Pembelian ditutup pada {season?.freezeDays ?? 3} hari terakhir season
          {season ? ` (${formatDateWIB(season.endAt)})` : ""}. Keranjangmu tetap tersimpan.
        </Alert>
      ) : null}

      {providers.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="Belum ada metode pembayaran aktif"
          description="Admin belum mengaktifkan gateway pembayaran. Hubungi bantuan bila ini berlangsung lama."
          action={
            <Link href="/faq">
              <Button variant="secondary">Buka FAQ</Button>
            </Link>
          }
        />
      ) : (
        <CheckoutForm
          providers={providers}
          defaultProviderId={preferred}
          items={cartProducts.map(({ product, quantity }) => ({
            productId: product.id,
            name: product.name,
            type: product.type,
            priceIdr: product.priceIdr,
            quantity,
          }))}
          season={season ? { name: season.name, endAt: season.endAt.toISOString(), freezeDays: season.freezeDays } : null}
          defaults={{
            mcName: profiles[0]?.displayName ?? "",
            email: viewer?.user.email ?? "",
          }}
          signedIn={Boolean(viewer)}
          couponsEnabled={settings.features.coupons}
          taxPercent={settings.store.taxPercent}
          taxLabel={settings.store.taxLabel}
          minimumAge={settings.store.minimumAge}
          frozen={frozen}
        />
      )}
    </div>
  );
}
