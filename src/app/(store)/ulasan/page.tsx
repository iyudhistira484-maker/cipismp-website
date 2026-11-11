import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, MessageSquare, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { ReviewForm } from "@/components/store/reviews";
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

export default async function PublicReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [settings, viewer] = await Promise.all([getSettings(), getViewer()]);

  if (!settings.features.reviews) {
    return (
      <div className="container-page py-12 lg:py-16">
        <p className="eyebrow">Komunitas</p>
        <h1 className="mt-2 font-display text-h1 text-ink">Ulasan pemain</h1>
        <Alert tone="info" className="mt-6" title="Ulasan sementara tidak tersedia">
          Admin sedang menonaktifkan fitur ulasan. Coba kembali nanti.
        </Alert>
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
    <div className="container-page py-12 lg:py-16">
      <div className="grid gap-8 lg:grid-cols-[1fr_320px] lg:items-end">
        <div>
          <p className="eyebrow">Dari pemain, untuk pemain</p>
          <h1 className="mt-2 text-balance font-display text-h1 text-ink">Ulasan komunitas</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
            Cerita pemain yang sudah membeli rank atau kit. Ulasan publik dimoderasi, dan nama akun
            disamarkan untuk menjaga privasi.
          </p>
        </div>
        <RatingPanel count={summary.count} average={summary.average} buckets={summary.buckets} />
      </div>

      {viewer ? (
        <section className="mt-10" aria-labelledby="my-reviews-title">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="eyebrow">Akunmu</p>
              <h2 id="my-reviews-title" className="mt-1 font-display text-lg text-ink">Ulasan saya</h2>
            </div>
            <span className="text-2xs text-muted-2">Hanya kamu yang dapat melihat ulasan yang belum tampil.</span>
          </div>
          {ownReviews.length === 0 ? (
            <div className="rounded-lg border border-line bg-surface/35 p-4 text-[13px] leading-relaxed text-muted">
              Belum ada ulasan dari akunmu. Setelah membeli rank atau kit dan pesanan lunas, kamu bisa
              mengulas dari halaman produk.
            </div>
          ) : (
            <div className="grid gap-3">
              {ownReviews.map((review) => (
                <article key={review.id} className="rounded-lg border border-line bg-surface/35 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/${review.productType.toLowerCase()}/${encodeURIComponent(review.productSlug)}#ulasan`}
                      className="font-medium text-ink hover:text-accent"
                    >
                      {review.productName}
                    </Link>
                    <ReviewStatus status={review.status} />
                    <time className="ml-auto text-2xs text-muted-2" dateTime={review.updatedAt.toISOString()}>
                      Diperbarui {formatDateTimeCompact(review.updatedAt)}
                    </time>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-2xs text-muted-2">
                    <Stars value={review.rating} size={12} />
                    <span>{review.rating}/5</span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-muted">{review.body}</p>
                  <details className="mt-3 border-t border-line pt-3">
                    <summary className="cursor-pointer text-[12.5px] font-medium text-accent hover:underline">
                      Edit ulasan saya
                    </summary>
                    <div className="mt-3">
                      <ReviewForm
                        productId={review.productId}
                        productName={review.productName}
                        review={{ id: review.id, rating: review.rating, body: review.body }}
                      />
                    </div>
                  </details>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : (
        <Alert tone="info" className="mt-8">
          <Link href="/masuk?next=%2Fulasan" className="font-medium text-accent hover:underline">
            Masuk
          </Link>{" "}
          untuk melihat dan mengedit ulasan milikmu. Ulasan baru hanya dapat dikirim dari halaman
          produk yang sudah kamu beli.
        </Alert>
      )}

      <section className="mt-12" aria-labelledby="public-reviews-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="eyebrow">Diterbitkan setelah moderasi</p>
            <h2 id="public-reviews-title" className="mt-1 font-display text-lg text-ink">Pengalaman pembeli</h2>
          </div>
          <span className="text-2xs text-muted-2">{feed.total} ulasan publik</span>
        </div>

        {feed.reviews.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="size-6" />}
            title="Belum ada ulasan yang tampil"
            description="Ulasan yang sudah disetujui moderator akan muncul di sini."
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {feed.reviews.map((review) => (
              <li key={review.id} className="rounded-lg border border-line bg-surface/40 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Stars value={review.rating} size={13} />
                  <span className="text-[13px] font-medium text-ink">{review.authorName}</span>
                  {review.verified ? (
                    <span className="inline-flex items-center gap-1 rounded-sm bg-success/10 px-1.5 py-0.5 text-2xs text-success">
                      <ShieldCheck className="size-3" aria-hidden /> Terverifikasi
                    </span>
                  ) : null}
                  <time className="ml-auto text-2xs text-muted-2" dateTime={review.createdAt.toISOString()}>
                    {formatDateTimeCompact(review.createdAt)}
                  </time>
                </div>
                <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-muted">{review.body}</p>
                <Link
                  href={`/${review.productType.toLowerCase()}/${encodeURIComponent(review.productSlug)}#ulasan`}
                  className="mt-3 inline-flex text-[12.5px] font-medium text-accent hover:underline"
                >
                  {review.productName}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 ? (
          <nav aria-label="Halaman ulasan" className="mt-6 flex items-center justify-center gap-3">
            {currentPage > 1 ? (
              <Link
                href={`/ulasan?page=${currentPage - 1}`}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-line px-3 text-[13px] text-muted hover:text-ink"
              >
                <ArrowLeft className="size-4" aria-hidden /> Sebelumnya
              </Link>
            ) : null}
            <span className="text-2xs tabular-nums text-muted-2">Halaman {currentPage} dari {totalPages}</span>
            {currentPage < totalPages ? (
              <Link
                href={`/ulasan?page=${currentPage + 1}`}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-line px-3 text-[13px] text-muted hover:text-ink"
              >
                Berikutnya <ArrowRight className="size-4" aria-hidden />
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </div>
  );
}

function RatingPanel({ count, average, buckets }: { count: number; average: number; buckets: number[] }) {
  return (
    <div className="rounded-lg border border-line bg-surface/50 p-4">
      <div className="flex items-center gap-3">
        <span className="font-pixel text-3xl text-ink">{count ? average.toFixed(1) : "—"}</span>
        <div>
          <Stars value={average} size={14} />
          <p className="mt-1 text-2xs text-muted-2">{count} ulasan disetujui</p>
        </div>
      </div>
      <div className="mt-3 space-y-1.5" aria-label="Sebaran rating">
        {[5, 4, 3, 2, 1].map((star) => {
          const amount = buckets[star - 1] ?? 0;
          const width = count ? (amount / count) * 100 : 0;
          return (
            <div key={star} className="grid grid-cols-[22px_1fr_24px] items-center gap-2 text-2xs text-muted-2">
              <span>{star} ★</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                <span className="block h-full rounded-full bg-accent" style={{ width: `${width}%` }} />
              </span>
              <span className="text-right tabular-nums">{amount}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReviewStatus({ status }: { status: "PENDING" | "APPROVED" | "HIDDEN" }) {
  const label = status === "APPROVED" ? "Tampil" : status === "PENDING" ? "Menunggu" : "Disembunyikan";
  const tone = status === "APPROVED" ? "success" : status === "PENDING" ? "warning" : "neutral";
  return <Badge tone={tone}>{label}</Badge>;
}
