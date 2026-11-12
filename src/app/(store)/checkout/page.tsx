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
import { env } from "@/server/env";
import { ArrowLeft, Sparkles } from "lucide-react";
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
  const cartProducts = lines.map((line) => ({ line, product: products.find((p) => p.id === line.productId) ?? null }));
  const hasUnavailableItems = cartProducts.some(({ product }) => !product);
  const hasMissingGiftRecipient = lines.some((line) => line.isGift && !line.targetName?.trim());

  const providers = await getAvailableProviders();
  const preferred = await defaultProvider(providers);
  const profiles = viewer ? await verifiedProfilesForUser(viewer.user.id) : [];
  const frozen = season ? isPurchaseFrozen(season) : false;

  return (
    <div className="container-page py-8 lg:py-12">
      <Link href="/keranjang" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted hover:text-accent-strong"><ArrowLeft className="size-3.5" aria-hidden /> Kembali ke keranjang</Link>
      <header className="relative isolate mt-6 overflow-hidden rounded-[24px] bg-[#493342] px-6 py-8 text-white shadow-[0_18px_45px_-28px_rgba(69,35,55,.6)] sm:px-9 sm:py-10"><div className="absolute inset-0 -z-10 bg-[url('/images/gameplay/forest-path.webp')] bg-cover bg-center" aria-hidden /><div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#2f1c2c]/95 via-[#4d3044]/90 to-[#4a3042]/65" aria-hidden /><p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.17em] text-[#ffe0ee]"><Sparkles className="size-3" aria-hidden /> YOUR SHOPPING JOURNEY</p><h1 className="mt-5 font-display text-[clamp(2rem,4vw,2.9rem)] leading-[1.1] tracking-[-.04em]">Satu langkah lagi<span className="text-[#f6b6d1]">.</span></h1><p className="mt-3 max-w-xl text-[13px] leading-relaxed text-white/80">Periksa pemain penerima, pilihan pembayaran, dan rincian pesananmu sebelum melanjutkan.</p></header>

      {!settings.store.checkoutEnabled ? <Alert tone="warning" className="mt-6" title="Checkout sedang dinonaktifkan">Keranjangmu tetap tersimpan. Pembayaran belum dapat dilanjutkan.</Alert> : null}
      {!season ? <Alert tone="warning" className="mt-6" title="Belum ada season aktif">Pembelian dibuka saat season dimulai.</Alert> : null}
      {hasUnavailableItems ? <Alert tone="warning" className="mt-6" title="Ada produk yang tidak tersedia">Hapus produk tersebut dari keranjang sebelum melanjutkan.</Alert> : null}
      {hasMissingGiftRecipient ? <Alert tone="warning" className="mt-6" title="Penerima hadiah tidak tersedia">Hapus item hadiah dari keranjang dan tambahkan kembali.</Alert> : null}
      {viewer && !viewer.user.emailVerifiedAt ? <Alert tone="warning" className="mt-6" title="Email akun belum diverifikasi">Verifikasi email akun sebelum checkout, atau keluar untuk checkout sebagai tamu.</Alert> : null}
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
          items={cartProducts.map(({ product, line }) => ({
            cartItemId: line.id,
            productId: line.productId,
            name: product?.name ?? "Produk tidak lagi tersedia",
            type: product?.type ?? null,
            priceIdr: product?.priceIdr ?? null,
            quantity: line.quantity,
            targetName: line.isGift ? line.targetName : null,
            isGift: line.isGift,
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
          blocked={frozen || !season || !settings.store.checkoutEnabled || hasUnavailableItems || hasMissingGiftRecipient || Boolean(viewer && !viewer.user.emailVerifiedAt)}
          offlineMode={env.MINECRAFT_LOOKUP_MODE === "offline"}
        />
      )}
    </div>
  );
}
