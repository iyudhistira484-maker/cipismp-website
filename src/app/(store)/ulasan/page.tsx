import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, MessageCircle, MessageSquareHeart, ShieldCheck, Sparkles, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ReviewForm } from "@/components/store/reviews";
import { DecorativeVideoBackground } from "@/components/store/decorative-video-background";
import { Stars } from "@/components/ui/stars";
import { getViewer } from "@/server/auth/guard";
import { getSettings } from "@/server/settings";
import { listOwnReviews, listPublicReviews, publicReviewSummary } from "@/server/reviews";
import { formatDateTimeCompact } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Ulasan pemain",
  description: "Baca pengalaman pemain CipiSMP memakai rank dan kit, serta ulasan terbaru dari komunitas.",
  alternates: { canonical: "/ulasan" },
  openGraph: {
    title: "Ulasan pemain · CipiSMP Store",
    description: "Baca pengalaman pembeli CipiSMP memakai rank dan kit.",
    url: "/ulasan",
  },
};

const PAGE_SIZE = 12;

export default async function PublicReviewsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [settings, viewer] = await Promise.all([getSettings(), getViewer()]);

  if (!settings.features.reviews) {
    return (
      <div className="container-page py-8 lg:py-12">
        <div className="rounded-[24px] border border-line bg-[#fcf4f9] px-6 py-10 sm:p-10">
          <p className="eyebrow">Komunitas CipiSMP</p>
          <h1 className="mt-3 font-display text-h1 text-ink">Ulasan pemain<span className="text-accent">.</span></h1>
          <p className="mt-4 text-[14px] leading-relaxed text-muted">Ulasan sementara tidak tersedia. Admin sedang menonaktifkan fitur ulasan; coba kembali nanti.</p>
          <Link href="/rank" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent-strong px-4 text-[12px] font-semibold text-white hover:bg-[#872454]">Jelajahi rank <ArrowRight className="size-4" aria-hidden /></Link>
        </div>
      </div>
    );
  }

  const [summary, firstFeed] = await Promise.all([
    publicReviewSummary(),
    listPublicReviews(PAGE_SIZE, (page - 1) * PAGE_SIZE),
  ]);
  const totalPages = Math.max(1, Math.ceil(firstFeed.total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const feed = currentPage === page ? firstFeed : await listPublicReviews(PAGE_SIZE, (currentPage - 1) * PAGE_SIZE);
  const ownReviews = viewer ? await listOwnReviews(viewer.user.id) : [];

  return (
    <div className="container-page space-y-7 py-8 lg:space-y-9 lg:py-12">
      <header className="relative isolate overflow-hidden rounded-[24px] bg-[#273235] px-6 py-10 sm:px-10 sm:py-12 lg:px-12 lg:py-14">
        <DecorativeVideoBackground
          src="https://motionbgs.com/media/3071/minecraft-rainy-landscape.960x540.mp4"
          poster="/images/gameplay/forest-path.webp"
          className="reviews-video absolute inset-0 -z-10 overflow-hidden bg-[#273235] bg-[url('/images/gameplay/forest-path.webp')] bg-cover bg-center"
          overlayClassName="absolute inset-0 bg-gradient-to-r from-[#1a2428]/95 via-[#243037]/85 to-[#243037]/60"
        />
        <div className="relative max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-[#ffe0ee]"><Sparkles className="size-3.5" aria-hidden /> Dari pemain, untuk pemain</p>
          <h1 className="mt-5 font-display text-[clamp(2.2rem,5vw,3.7rem)] leading-[1.06] tracking-[-.04em] text-white">Cerita dari <span className="text-[#f6b6d1]">komunitas.</span></h1>
          <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-white/90 sm:text-[15px]">Pengalaman pemain bersama rank dan kit CipiSMP. Ulasan dimoderasi sebelum tampil dan nama akun disamarkan untuk menjaga privasi.</p>
          <div className="mt-6 flex flex-wrap gap-2.5"><a href="#pengalaman-pembeli" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent-strong px-4 text-[12px] font-semibold text-white hover:bg-[#872454]">Lihat ulasan <ArrowRight className="size-4" aria-hidden /></a><Link href="/rank" className="inline-flex min-h-11 items-center rounded-xl border border-[#e5d1df] bg-white/80 px-4 text-[12px] font-semibold text-ink hover:bg-white">Jelajahi rank</Link></div>
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8">
        <div className="min-w-0 space-y-8">
          {viewer ? (
            <section aria-labelledby="my-reviews-title" className="rounded-[22px] border border-line bg-white p-5 shadow-card sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="eyebrow">Akunmu</p><h2 id="my-reviews-title" className="mt-1 font-display text-[22px] text-ink">Ulasan saya<span className="text-accent">.</span></h2><p className="mt-1 text-[12px] leading-relaxed text-muted">Hanya kamu yang dapat melihat ulasanmu yang belum tampil.</p></div>
                <span className="grid size-10 place-items-center rounded-xl bg-[#f9eaf2] text-accent-strong"><MessageSquareHeart className="size-5" aria-hidden /></span>
              </div>
              {ownReviews.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-[#e8d6e1] bg-[#fdf9fc] p-5">
                  <p className="text-[13px] font-semibold text-ink">Belum ada ulasan dari akunmu</p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">Setelah pembelian memenuhi syarat, kamu bisa menulis ulasan dari halaman produknya.</p>
                  <Link href="/rank" className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-accent-strong hover:underline">Jelajahi produk <ArrowRight className="size-3.5" aria-hidden /></Link>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {ownReviews.map((review) => (
                    <article key={review.id} className="rounded-2xl border border-line bg-[#fdfafd] p-4 sm:p-5">
                      <div className="flex flex-wrap items-center gap-2"><Link href={`/${review.productType.toLowerCase()}/${encodeURIComponent(review.productSlug)}#ulasan`} className="break-words text-[14px] font-semibold text-ink hover:text-accent">{review.productName}</Link><ReviewStatus status={review.status} /><time className="text-[11px] text-muted-2 sm:ml-auto" dateTime={review.updatedAt.toISOString()}>Diperbarui {formatDateTimeCompact(review.updatedAt)}</time></div>
                      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted"><Stars value={review.rating} size={13} /><span>{review.rating}/5</span></div>
                      <p className="mt-3 whitespace-pre-line break-words text-[13px] leading-relaxed text-muted">{review.body}</p>
                      <details className="mt-4 border-t border-line pt-3"><summary className="cursor-pointer text-[12.5px] font-semibold text-accent-strong hover:underline">Edit ulasan saya</summary><div className="mt-4"><ReviewForm productId={review.productId} productName={review.productName} review={{ id: review.id, rating: review.rating, body: review.body }} /></div></details>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-[#efdeea] bg-[#fcf4f9] p-5 sm:p-6">
              <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-accent-strong"><MessageSquareHeart className="size-5" aria-hidden /></span><div><h2 className="font-display text-[17px] text-ink">Punya cerita untuk dibagikan?</h2><p className="mt-1 max-w-lg text-[12.5px] leading-relaxed text-muted">Masuk untuk melihat atau mengedit ulasanmu. Ulasan baru ditulis dari halaman produk yang memenuhi syarat.</p></div></div>
              <Link href="/masuk?next=%2Fulasan" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#e4cadb] bg-white px-4 text-[12px] font-semibold text-accent-strong hover:bg-[#fff9fc]">Masuk ke akun</Link>
            </div>
          )}

          <section id="pengalaman-pembeli" aria-labelledby="public-reviews-title" className="scroll-mt-24">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-5"><div><p className="eyebrow">Suara komunitas</p><h2 id="public-reviews-title" className="mt-1 font-display text-[25px] text-ink">Pengalaman pembeli<span className="text-accent">.</span></h2><p className="mt-1 text-[12.5px] text-muted">Diterbitkan setelah moderasi.</p></div><span className="rounded-full border border-line bg-white px-3 py-1.5 text-[11px] font-semibold text-muted">{feed.total} ulasan publik</span></div>
            {feed.reviews.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-[#e7d6e1] bg-white px-6 py-12 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f9eaf2] text-accent-strong"><MessageCircle className="size-6" aria-hidden /></span><h3 className="mt-4 font-display text-[19px] text-ink">Belum ada ulasan yang tampil</h3><p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted">Ulasan yang sudah disetujui moderator akan muncul di sini.</p><Link href="/rank" className="mt-5 inline-flex items-center gap-1 text-[12px] font-semibold text-accent-strong hover:underline">Jelajahi rank <ArrowRight className="size-3.5" aria-hidden /></Link></div>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {feed.reviews.map((review) => (
                  <li key={review.id} className="flex min-w-0 flex-col rounded-[20px] border border-line bg-white p-5 shadow-card">
                    <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f9eaf2] font-display text-[15px] font-semibold uppercase text-accent-strong" aria-hidden>{review.authorName.charAt(0)}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="break-words text-[13px] font-semibold text-ink">{review.authorName}</span>{review.verified ? <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success"><ShieldCheck className="size-3" aria-hidden /> Terverifikasi</span> : null}</div><time className="mt-1 block text-[11px] text-muted-2" dateTime={review.createdAt.toISOString()}>Diperbarui {formatDateTimeCompact(review.createdAt)}</time></div></div>
                    <div className="mt-4 flex items-center gap-2"><Stars value={review.rating} size={14} /><span className="text-[11px] font-medium text-muted">{review.rating}/5</span></div>
                    <p className="mt-3 flex-1 whitespace-pre-line break-words text-[13px] leading-relaxed text-muted">{review.body}</p>
                    <Link href={`/${review.productType.toLowerCase()}/${encodeURIComponent(review.productSlug)}#ulasan`} className="mt-5 inline-flex items-center gap-1 self-start text-[12px] font-semibold text-accent-strong hover:underline">{review.productName} <ArrowRight className="size-3.5" aria-hidden /></Link>
                  </li>
                ))}
              </ul>
            )}
            {totalPages > 1 ? (
              <nav aria-label="Halaman ulasan" className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {currentPage > 1 ? <Link href={`/ulasan?page=${currentPage - 1}`} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-line bg-white px-3 text-[12px] font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden /> Sebelumnya</Link> : null}
                <span className="text-[11px] tabular-nums text-muted">Halaman {currentPage} dari {totalPages}</span>
                {currentPage < totalPages ? <Link href={`/ulasan?page=${currentPage + 1}`} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-line bg-white px-3 text-[12px] font-semibold text-muted hover:text-ink">Berikutnya <ArrowRight className="size-4" aria-hidden /></Link> : null}
              </nav>
            ) : null}
          </section>
        </div>
        <aside aria-label="Informasi ulasan" className="min-w-0 space-y-4 lg:sticky lg:top-24">
          <RatingPanel count={summary.count} average={summary.average} buckets={summary.buckets} />
          <section className="rounded-[22px] border border-line bg-white p-5 sm:p-6"><span className="grid size-10 place-items-center rounded-xl bg-[#f3edf9] text-[#8963a1]"><ShieldCheck className="size-5" aria-hidden /></span><h2 className="mt-4 font-display text-[17px] text-ink">Ulasan yang bermakna</h2><p className="mt-2 text-[12.5px] leading-relaxed text-muted">Ulasan produk berasal dari akun pembeli yang memenuhi syarat. Ulasan publik ditinjau sebelum tampil dan nama akun disamarkan.</p></section>
          <section className="rounded-[22px] border border-line bg-white p-5 sm:p-6"><div className="flex items-start gap-3"><BookOpen className="mt-0.5 size-5 shrink-0 text-accent-strong" aria-hidden /><div><h2 className="font-display text-[16px] text-ink">Baru di CipiSMP?</h2><p className="mt-2 text-[12px] leading-relaxed text-muted">Pelajari cara membeli dan menghubungkan akun Minecraft.</p><Link href="/cara-kerja" className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-accent-strong hover:underline">Lihat cara kerja <ArrowRight className="size-3.5" aria-hidden /></Link></div></div></section>
        </aside>
      </div>
    </div>
  );
}

function RatingPanel({ count, average, buckets }: { count: number; average: number; buckets: number[] }) {
  return (
    <section aria-labelledby="rating-title" className="rounded-[22px] border border-line bg-white p-5 shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">Ringkasan komunitas</p><h2 id="rating-title" className="mt-1 font-display text-[18px] text-ink">Rating pemain</h2></div><span className="grid size-10 place-items-center rounded-xl bg-[#fff4e6] text-[#b57c30]"><Star className="size-5" aria-hidden /></span></div>
      <div className="mt-5 flex items-center gap-3"><span className="font-display text-[38px] leading-none text-ink">{count ? average.toFixed(1) : "—"}</span><div>{count ? <Stars value={average} size={14} /> : <p className="text-[12px] font-medium text-muted">Belum ada rating</p>}<p className="mt-1 text-[11px] text-muted-2">{count} ulasan disetujui</p></div></div>
      <div className="mt-5 space-y-2" aria-label="Sebaran rating">{[5, 4, 3, 2, 1].map((star) => { const amount = buckets[star - 1] ?? 0; const width = count ? (amount / count) * 100 : 0; return <div key={star} className="grid grid-cols-[28px_1fr_24px] items-center gap-2 text-[11px] text-muted"><span>{star} ★</span><span className="h-1.5 overflow-hidden rounded-full bg-[#f3eaf0]" aria-hidden><span className="block h-full rounded-full bg-accent" style={{ width: `${width}%` }} /></span><span className="text-right tabular-nums">{amount}</span></div>; })}</div>
    </section>
  );
}

function ReviewStatus({ status }: { status: "PENDING" | "APPROVED" | "HIDDEN" }) {
  const label = status === "APPROVED" ? "Tampil" : status === "PENDING" ? "Menunggu" : "Disembunyikan";
  const tone = status === "APPROVED" ? "success" : status === "PENDING" ? "warning" : "neutral";
  return <Badge tone={tone}>{label}</Badge>;
}
