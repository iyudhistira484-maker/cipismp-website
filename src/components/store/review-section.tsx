import Link from "next/link";
import { MessageSquare, ShieldCheck } from "lucide-react";
import { ReviewForm } from "@/components/store/reviews";
import { Stars } from "@/components/ui/stars";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { getViewer } from "@/server/auth/guard";
import { getSettings } from "@/server/settings";
import {
  listApprovedReviews,
  ratingSummary,
  reviewEligibility,
  type ProductReview,
  type RatingSummary,
} from "@/server/reviews";
import { formatDateTimeCompact } from "@/lib/dates";

export async function ReviewSection({ productId, productName }: { productId: string; productName: string }) {
  const settings = await getSettings();
  if (!settings.features.reviews) return null;

  const viewer = await getViewer();
  const [summary, reviews, eligibility] = await Promise.all([
    ratingSummary(productId),
    listApprovedReviews(productId),
    reviewEligibility(viewer?.user.id ?? null, productId),
  ]);

  return (
    <section id="ulasan" className="scroll-mt-24 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Ulasan pembeli</h2>
          <p className="mt-1 text-[13px] text-muted">
            Hanya pembeli produk ini yang bisa menulis ulasan, dan setiap akun maksimal satu ulasan.
          </p>
        </div>
        <RatingBadge summary={summary} />
      </div>

      {eligibility.canReview ? (
        <div className="rounded-lg border border-line bg-surface/40 p-4">
          <h3 className="mb-3 text-[13.5px] font-medium text-ink">Tulis ulasanmu</h3>
          <ReviewForm productId={productId} productName={productName} />
        </div>
      ) : eligibility.reason === "ALREADY_REVIEWED" ? (
        <div className="space-y-3">
          <Alert tone="info" title="Kamu sudah mengulas produk ini">
            {eligibility.existing?.status === "APPROVED"
              ? "Ulasanmu tampil di bawah. Jika mengubahnya, ulasan akan kembali ke moderasi."
              : eligibility.existing?.status === "PENDING"
                ? "Ulasanmu sedang menunggu moderasi admin. Kamu masih bisa mengoreksinya."
                : "Ulasanmu disembunyikan moderator. Kamu masih bisa mengoreksinya dan mengirim untuk ditinjau ulang."}
          </Alert>
          {eligibility.existing ? (
            <div className="rounded-lg border border-line bg-surface/40 p-4">
              <h3 className="mb-3 text-[13.5px] font-medium text-ink">Edit ulasanmu</h3>
              <ReviewForm productId={productId} productName={productName} review={eligibility.existing} />
            </div>
          ) : null}
        </div>
      ) : eligibility.reason === "NOT_PURCHASED" ? (
        <Alert tone="info">Ulasan terbuka otomatis setelah pesananmu untuk produk ini lunas dan terkirim.</Alert>
      ) : (
        <Alert tone="info">
          <Link href="/masuk?next=%2Fulasan" className="font-medium text-accent hover:underline">Masuk ke akunmu</Link>{" "}
          untuk melihat apakah kamu bisa mengulas produk ini.
        </Alert>
      )}

      {reviews.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="size-6" />}
          title="Belum ada ulasan"
          description="Jadilah pembeli pertama yang membagikan pengalaman memakai produk ini."
        />
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </ul>
      )}
    </section>
  );
}

function RatingBadge({ summary }: { summary: RatingSummary }) {
  if (summary.count === 0) {
    return <span className="text-[12.5px] text-muted-2">Belum dinilai</span>;
  }
  return (
    <div className="flex items-center gap-3 rounded-md border border-line bg-surface/40 px-3 py-2">
      <span className="font-pixel text-xl text-ink">{summary.average.toFixed(1)}</span>
      <div className="space-y-0.5">
        <Stars value={summary.average} />
        <p className="text-2xs text-muted-2">{summary.count} ulasan</p>
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: ProductReview }) {
  return (
    <li className="rounded-lg border border-line bg-bg/40 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars value={review.rating} size={13} />
        <span className="text-[13px] font-medium text-ink">{review.authorName}</span>
        {review.verified ? (
          <span className="inline-flex items-center gap-1 rounded-sm bg-success/10 px-1.5 py-0.5 text-2xs text-success">
            <ShieldCheck className="size-3" aria-hidden /> Pembelian terverifikasi
          </span>
        ) : null}
        <time className="ml-auto text-2xs text-muted-2" dateTime={review.createdAt.toISOString()}>
          {formatDateTimeCompact(review.createdAt)}
        </time>
      </div>
      <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-muted">{review.body}</p>
    </li>
  );
}
