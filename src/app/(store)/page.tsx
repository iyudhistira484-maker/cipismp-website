import Link from "next/link";
import { ArrowRight, Clock3, Compass, ShieldCheck } from "lucide-react";
import { BrandScene } from "@/components/store/brand-scene";
import { HeroVideoBackground } from "@/components/store/hero-video-background";
import { DoubleMarquee } from "@/components/store/double-marquee";
import { ScrollReveal } from "@/components/store/scroll-reveal";
import { StoreHighlights } from "@/components/store/store-highlights";
import { GameplayGallery } from "@/components/store/gameplay-gallery";
import { JoinGuide, JoinGuideSkeleton } from "@/components/store/join-guide";
import { ServerStatusPanel, ServerStatusSkeleton } from "@/components/store/server-status";
import { KitCard, RankCard } from "@/components/store/product-cards";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { getActiveSeason, getKitItemsForProducts, getPublishedProducts } from "@/server/catalog";
import { getServerConnectionInfo, getServerStatus } from "@/server/server-status";
import { getSettings } from "@/server/settings";
import { ratingMap } from "@/server/reviews";
import { formatDateWIB } from "@/lib/dates";
import { daysLeftInSeason } from "@/lib/seasons";
import { FAQ_ITEMS } from "@/content/faq";
import { Suspense } from "react";

export const revalidate = 60;

export default async function HomePage() {
  const [ranks, kits, season, settings] = await Promise.all([
    getPublishedProducts("RANK"),
    getPublishedProducts("KIT"),
    getActiveSeason(),
    getSettings(),
  ]);
  const ratings = await ratingMap([...ranks, ...kits].map((product) => product.id));
  const kitItems = await getKitItemsForProducts(kits.map((k) => k.id));
  const itemsByProduct = new Map<string, typeof kitItems>();
  for (const item of kitItems) {
    const list = itemsByProduct.get(item.productId) ?? [];
    list.push(item);
    itemsByProduct.set(item.productId, list);
  }
  const daysLeft = season ? daysLeftInSeason(season) : null;

  return (
    <div>
      {/* ------------------------------------------------------------- hero */}
      <section className="landing-hero">
        <HeroVideoBackground />
        <div className="landing-hero__scrim" aria-hidden="true" />
        <div className="container-page flex min-h-[580px] items-start pb-44 pt-10 sm:min-h-[610px] sm:pb-48 sm:pt-16 lg:min-h-[610px] lg:items-center lg:py-20">
          <div className="w-full max-w-xl lg:max-w-[52%]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">
                {season ? season.name : "Server survival Minecraft"}
              </Badge>
              {season ? (
                <span className="text-2xs text-muted-2">
                  Berakhir {formatDateWIB(season.endAt)}
                  {daysLeft !== null ? ` · ${daysLeft} hari lagi` : ""}
                </span>
              ) : null}
            </div>

            <h1 className="mt-5 max-w-3xl text-balance font-display text-display font-semibold text-ink">
              Main survival<br className="hidden sm:block" /> bareng CipiSMP.
            </h1>

            <p className="mt-5 max-w-xl text-pretty text-[16px] leading-relaxed text-muted">
              Server Minecraft survival untuk Java dan Bedrock. Lihat alamat server, cek pilihan rank
              dan kit, lalu pilih yang sesuai dengan cara bermainmu.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/rank"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-accent px-6 text-[15px] font-semibold text-accent-ink transition-colors duration-150 hover:bg-accent-strong active:translate-y-px"
              >
                Lihat rank
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="/cara-kerja"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-line-strong bg-white px-6 text-[15px] font-semibold text-ink transition-colors duration-150 hover:border-accent/50 hover:bg-surface-2"
              >
                Cara bergabung
              </Link>
            </div>

            <dl className="mt-8 grid max-w-xl grid-cols-3 gap-2 rounded-xl border border-white/70 bg-white/85 px-3 py-3 sm:gap-4 sm:px-4 lg:rounded-none lg:border-0 lg:border-t lg:border-line lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-5">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-2">Edisi</dt>
                <dd className="mt-1 text-[13px] font-medium text-ink">Java &amp; Bedrock</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-2">Masa aktif</dt>
                <dd className="mt-1 text-[13px] font-medium text-ink">Sesuai season</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-2">Pengiriman</dt>
                <dd className="mt-1 text-[13px] font-medium text-ink">Otomatis</dd>
              </div>
            </dl>
          </div>

        </div>
      </section>

      <DoubleMarquee />

      <section id="info-server" aria-labelledby="server-info-heading" className="container-page scroll-mt-24 py-10 sm:py-14">
        <div className="relative isolate overflow-hidden rounded-[24px] border border-line bg-gradient-to-br from-[#fff8fc] via-white to-[#f5f1fa] p-5 shadow-card sm:p-7 lg:p-9">
          <span aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-[#efdeed]/60 blur-3xl" />
          <div className="relative grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
            <div className="min-w-0">
              <p className="eyebrow">CipiSMP · Java &amp; Bedrock</p>
              <h2 id="server-info-heading" className="mt-2 font-display text-h2 text-ink">Siap bertemu di server<span className="text-accent">.</span></h2>
              <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-muted sm:text-[14px]">Simpan alamat server untuk mulai bermain. Cek status dan pilih edisi Minecraft yang kamu gunakan.</p>
              <BrandScene seasonName={season?.name} />
              <div className="grid gap-3 sm:grid-cols-2">
                <p className="flex items-start gap-2.5 rounded-2xl border border-line bg-white/80 p-3.5 text-[12px] leading-relaxed text-muted"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />Pembayaran melalui Tripay atau Midtrans; metode yang tersedia mengikuti konfigurasi aktif.</p>
                <p className="flex items-start gap-2.5 rounded-2xl border border-line bg-white/80 p-3.5 text-[12px] leading-relaxed text-muted"><Clock3 className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />Pengiriman otomatis setelah pembayaran terverifikasi; pemain offline perlu masuk dan login di server.</p>
              </div>
            </div>
            <Suspense fallback={<ServerStatusSkeleton />}>
              <ServerStatus />
            </Suspense>
          </div>
        </div>
      </section>
      <StoreHighlights />
      <GameplayGallery />
      <ScrollReveal delay={60} className="join-guide-reveal">
        <Suspense fallback={<JoinGuideSkeleton />}>
          <JoinGuideSection supportEmail={settings.site.supportEmail} />
        </Suspense>
      </ScrollReveal>

      {/* ------------------------------------------------------------ ranks */}
      <ScrollReveal delay={40}>
        <section aria-labelledby="rank-heading" className="container-page pt-8">
          <div className="flex flex-wrap items-end justify-between gap-4 border-t border-line pt-10">
            <div>
              <p className="eyebrow">Katalog rank</p>
              <h2 id="rank-heading" className="mt-2 max-w-xl text-balance font-display text-h1 text-ink">
                Pilih rank untuk season ini.
              </h2>
              <p className="mt-3 max-w-xl text-pretty text-[14.5px] leading-relaxed text-muted">
                Harga, masa aktif, dan keuntungan tiap rank ditampilkan sebelum checkout. Tidak ada
                keuntungan PvP atau damage tambahan.
              </p>
            </div>
            <Link
              href="/rank"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent transition-colors hover:text-accent-strong"
            >
              Bandingkan semua tier
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {ranks.map((rank) => (
              <RankCard
                key={rank.id}
                product={rank}
                season={season ? { name: season.name, endAt: season.endAt } : null}
                rating={ratings.get(rank.id)}
              />
            ))}
          </div>
          {ranks.length === 0 ? (
            <p className="mt-6 rounded-lg border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
              Rank untuk season ini belum dibuka. Pantau Discord untuk pengumuman.
            </p>
          ) : null}
        </section>
      </ScrollReveal>

      {/* ------------------------------------------------------------- kits */}
      <ScrollReveal delay={60}>
        <section aria-labelledby="kit-heading" className="container-page pt-20">
          <div className="grid gap-8 border-t border-line pt-10 lg:grid-cols-[1fr_1.6fr] lg:gap-12">
            <div>
              <p className="eyebrow">Kit season</p>
              <h2 id="kit-heading" className="mt-2 text-balance font-display text-h2 text-ink">
                Perlengkapan untuk awal season.
              </h2>
              <p className="mt-3 text-pretty text-[14.5px] leading-relaxed text-muted">
                Periksa isi dan jumlah item pada setiap kit sebelum memilih. Batas pembelian per pemain
                tercantum di kartu.
              </p>
              <p className="mt-5 flex items-start gap-2 rounded-md border border-line bg-white p-3.5 text-2xs leading-relaxed text-muted-2">
                <Compass className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
                Pilih nama item untuk melihat keterangan dan detailnya.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {kits.map((kit) => (
                <KitCard
                  key={kit.id}
                  product={kit}
                  items={itemsByProduct.get(kit.id) ?? []}
                  season={season ? { name: season.name, endAt: season.endAt } : null}
                  rating={ratings.get(kit.id)}
                />
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ------------------------------------------------------ how it works */}
      <ScrollReveal delay={40}>
        <section aria-labelledby="how-heading" className="container-page pt-20">
          <div className="border-t border-line pt-10">
            <p className="eyebrow">Cara pembelian</p>
            <h2 id="how-heading" className="mt-2 max-w-2xl text-balance font-display text-h2 text-ink">
              Dari pilih produk sampai item diterima.
            </h2>
          </div>
          <ol className="mt-8 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Tulis username Minecraft",
                body: "Java atau Bedrock (nama dengan titik di depan). Kami memverifikasi ke Mojang dan menampilkan kepala skin sebelum kamu bayar.",
              },
              {
                title: "Pilih rank atau kit",
                body: "Harga dan total dihitung di server. Kalau kamu sudah punya rank lebih rendah, yang dibayar hanya selisihnya.",
              },
              {
                title: "Bayar lewat QRIS / VA / e-wallet",
                body: "Tripay atau Midtrans. Status pesanan berubah hanya setelah webhook terverifikasi, bukan dari halaman redirect.",
              },
              {
                title: "Akses aktif otomatis",
                body: "Setelah pembayaran, akses rank atau permission PlayerKits dikirim ke server. Kalau kamu offline, perintah dijalankan saat login berikutnya dan tercatat di riwayat.",
              },
            ].map((step, index) => (
              <li key={step.title} className="bg-surface p-5">
                <span className="font-mono text-[11px] text-accent">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 text-[15px] font-medium text-ink">{step.title}</h3>
                <p className="mt-1.5 text-pretty text-[13px] leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </ScrollReveal>

      {/* --------------------------------------------------------------- faq */}
      <ScrollReveal delay={60}>
        <section aria-labelledby="faq-heading" className="container-page pt-20">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.6fr] lg:gap-16">
            <div>
              <p className="eyebrow">FAQ</p>
              <h2 id="faq-heading" className="mt-2 font-display text-h2 text-ink">
                Pertanyaan yang sering muncul.
              </h2>
              <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
                Belum terjawab? Kirim email ke{" "}
                <a href={`mailto:${settings.site.supportEmail}`} className="text-accent hover:underline">
                  {settings.site.supportEmail}
                </a>
                .
              </p>
            </div>
            <Accordion type="single" collapsible className="border-t-0">
              {FAQ_ITEMS.slice(0, 6).map((item) => (
                <AccordionItem key={item.id} value={item.id} question={item.question}>
                  <p>{item.answer}</p>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      </ScrollReveal>
    </div>
  );
}

async function JoinGuideSection({ supportEmail }: { supportEmail: string }) {
  const connection = await getServerConnectionInfo();
  return <JoinGuide connection={connection} supportEmail={supportEmail} />;
}

async function ServerStatus() {
  const status = await getServerStatus();
  return <ServerStatusPanel initial={status} />;
}
