import Link from "next/link";
import { ArrowRight, Clock3, Compass, ShieldCheck, Sparkles } from "lucide-react";
import { ServerStatusPanel, ServerStatusSkeleton } from "@/components/store/server-status";
import { KitCard, RankCard } from "@/components/store/product-cards";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { getActiveSeason, getKitItemsForProducts, getPublishedProducts } from "@/server/catalog";
import { getServerStatus } from "@/server/server-status";
import { getSettings } from "@/server/settings";
import { ratingMap } from "@/server/reviews";
import { formatDateWIB, daysUntil } from "@/lib/dates";
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
  const daysLeft = season ? daysUntil(season.endAt) : null;

  return (
    <div>
      {/* ------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-grid opacity-[0.18] [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]"
          aria-hidden
        />
        <div className="container-page relative grid gap-12 pb-16 pt-14 lg:grid-cols-12 lg:gap-8 lg:pb-24 lg:pt-20">
          <div className="lg:col-span-7 lg:pr-10">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">
                <Sparkles className="size-2.5" aria-hidden />
                {season ? `${season.name} · Sedang berjalan` : "Menunggu season baru"}
              </Badge>
              {season ? (
                <span className="text-2xs text-muted-2">
                  Berakhir {formatDateWIB(season.endAt)}
                  {daysLeft !== null ? ` · ${daysLeft} hari lagi` : ""}
                </span>
              ) : null}
            </div>

            <h1 className="mt-6 text-balance font-display text-display font-semibold text-ink">
              Bangun sesuatu
              <br />
              yang layak
              <span className="relative ml-2 inline-block text-accent">
                ditinggali.
                <svg
                  viewBox="0 0 220 12"
                  className="absolute -bottom-1.5 left-0 h-2.5 w-full text-accent/45"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path d="M2 9 C 60 2, 150 2, 218 7" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                </svg>
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-pretty text-[15.5px] leading-relaxed text-muted">
              Rank dan kit CipiSMP dibuat untuk pemain yang tinggal lebih dari satu malam. Semuanya
              berlaku sampai akhir season, dikirim otomatis ke akun Minecraft kamu — Java maupun
              Bedrock.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/rank"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-accent px-6 text-[15px] font-medium text-accent-ink shadow-[0_1px_0_0_rgb(255_255_255/0.25)_inset,0_10px_24px_-16px_rgb(224_168_78/0.9)] transition-all duration-150 hover:bg-accent-strong active:translate-y-px"
              >
                Lihat rank
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="/kit"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-line-strong bg-surface-2 px-6 text-[15px] font-medium text-ink transition-colors duration-150 hover:bg-surface-3"
              >
                Isi kit season ini
              </Link>
            </div>

            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-4 border-t border-line pt-6">
              <div>
                <dt className="text-2xs uppercase tracking-wider text-muted-2">Masa aktif</dt>
                <dd className="mt-1 text-[13.5px] text-ink">Sampai akhir season</dd>
              </div>
              <div>
                <dt className="text-2xs uppercase tracking-wider text-muted-2">Edisi</dt>
                <dd className="mt-1 text-[13.5px] text-ink">Java &amp; Bedrock</dd>
              </div>
              <div>
                <dt className="text-2xs uppercase tracking-wider text-muted-2">Pengiriman</dt>
                <dd className="mt-1 text-[13.5px] text-ink">Otomatis</dd>
              </div>
            </dl>
          </div>

          <div className="lg:col-span-5">
            <Suspense fallback={<ServerStatusSkeleton />}>
              <ServerStatus />
            </Suspense>

            <div className="mt-4 space-y-2.5 rounded-lg border border-line bg-surface/60 p-4">
              <p className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-muted">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                Pembayaran lewat Tripay &amp; Midtrans: QRIS, virtual account, dan e-wallet.
              </p>
              <p className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-muted">
                <Clock3 className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                Item masuk otomatis setelah pembayaran terverifikasi. Kalau kamu offline, item menunggu
                sampai login berikutnya.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ ranks */}
      <section aria-labelledby="rank-heading" className="container-page pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4 border-t border-line pt-10">
          <div>
            <p className="eyebrow">Rank season ini</p>
            <h2 id="rank-heading" className="mt-2 max-w-xl text-balance font-display text-h1 text-ink">
              Rank Cipi untuk season ini.
            </h2>
            <p className="mt-3 max-w-xl text-pretty text-[14.5px] leading-relaxed text-muted">
              Tiap rank menawarkan kombinasi kenyamanan dan kosmetik yang berbeda. Lihat kartu untuk
              detail tier, keuntungan, dan harga; tidak ada damage, speed, atau keuntungan PvP.
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

      {/* ------------------------------------------------------------- kits */}
      <section aria-labelledby="kit-heading" className="container-page pt-20">
        <div className="grid gap-8 border-t border-line pt-10 lg:grid-cols-[1fr_1.6fr] lg:gap-12">
          <div>
            <p className="eyebrow">Kit musiman</p>
            <h2 id="kit-heading" className="mt-2 text-balance font-display text-h2 text-ink">
              Isi yang benar-benar habis dipakai.
            </h2>
            <p className="mt-3 text-pretty text-[14.5px] leading-relaxed text-muted">
              Kit dirakit dari barang yang sering dicari di hari pertama season: makanan, alat, material
              bangunan, sampai peralatan perjalanan. Satu kali per pemain setiap season.
            </p>
            <p className="mt-5 flex items-start gap-2 rounded-md border border-line bg-surface/60 p-3.5 text-2xs leading-relaxed text-muted-2">
              <Compass className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
              Arahkan kursor ke nama item untuk melihat detail seperti tooltip di dalam game.
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

      {/* ------------------------------------------------------ how it works */}
      <section aria-labelledby="how-heading" className="container-page pt-20">
        <div className="border-t border-line pt-10">
          <p className="eyebrow">Cara kerja</p>
          <h2 id="how-heading" className="mt-2 max-w-2xl text-balance font-display text-h2 text-ink">
            Empat langkah, tanpa perlu menghubungi admin.
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
              title: "Item masuk otomatis",
              body: "Perintah dijalankan ke server. Kalau kamu offline, item dikirim saat login berikutnya dan tercatat di riwayat.",
            },
          ].map((step, index) => (
            <li key={step.title} className="bg-surface p-5">
              <span className="font-pixel text-[11px] text-accent">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="mt-3 text-[15px] font-medium text-ink">{step.title}</h3>
              <p className="mt-1.5 text-pretty text-[13px] leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* --------------------------------------------------------------- faq */}
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
    </div>
  );
}

async function ServerStatus() {
  const status = await getServerStatus();
  return <ServerStatusPanel initial={status} />;
}
