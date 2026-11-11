import Link from "next/link";
import { requireStaff } from "@/server/auth/guard";
import { listReviewsForModeration, reviewCounts } from "@/server/reviews";
import { Stars } from "@/components/store/reviews";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/feedback";
import { AdminPageHeader, Card, Table, Td } from "@/components/admin/shell";
import { ModerateReviewButton } from "@/components/admin/review-moderation";
import { formatDateTimeCompact } from "@/lib/dates";

export const metadata = { title: "Ulasan" };

const TABS = [
  { key: "PENDING", label: "Menunggu" },
  { key: "APPROVED", label: "Tampil" },
  { key: "HIDDEN", label: "Disembunyikan" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireStaff("products.write");
  const { status } = await searchParams;
  const active: TabKey = TABS.some((tab) => tab.key === status) ? (status as TabKey) : "PENDING";

  const [counts, reviews] = await Promise.all([reviewCounts(), listReviewsForModeration(active)]);

  return (
    <>
      <AdminPageHeader
        title="Ulasan pembeli"
        description="Hanya pembeli terverifikasi yang bisa menulis ulasan. Setiap ulasan baru masuk antrean moderasi sebelum tampil di halaman produk."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/ulasan?status=${tab.key}`}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] transition-colors ${
              active === tab.key
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-line text-muted hover:border-line-strong hover:text-ink"
            }`}
          >
            {tab.label}
            <span className="text-2xs text-muted-2">{counts[tab.key]}</span>
          </Link>
        ))}
      </div>

      {active === "PENDING" && counts.PENDING > 0 ? (
        <Alert tone="info" className="mb-4">
          {counts.PENDING} ulasan menunggu moderasi. Setujui agar tampil di halaman produk, atau sembunyikan bila melanggar
          aturan.
        </Alert>
      ) : null}

      <Card>
        <Table head={["Produk", "Rating", "Ulasan", "Penulis", "Pesanan", "Waktu", "Aksi"]} empty={reviews.length === 0}>
          {reviews.map((review) => (
            <tr key={review.id}>
              <Td className="align-top">
                <Link href={`/admin/produk`} className="text-ink hover:text-accent">
                  {review.productName}
                </Link>
                <p className="text-2xs text-muted-2">/{review.productSlug}</p>
              </Td>
              <Td className="align-top">
                <Stars value={review.rating} size={12} />
              </Td>
              <Td className="max-w-[320px] align-top text-muted">
                <p className="whitespace-pre-line">{review.body}</p>
              </Td>
              <Td className="align-top">{review.authorName}</Td>
              <Td className="align-top">
                {review.orderNumber ? (
                  <span className="font-mono text-2xs text-success">{review.orderNumber}</span>
                ) : (
                  <span className="text-2xs text-muted-2">—</span>
                )}
              </Td>
              <Td className="align-top text-2xs text-muted-2">{formatDateTimeCompact(review.createdAt)}</Td>
              <Td className="align-top">
                <div className="flex flex-col gap-1.5">
                  {review.status !== "APPROVED" ? (
                    <ModerateReviewButton reviewId={review.id} status="APPROVED" />
                  ) : null}
                  {review.status !== "HIDDEN" ? (
                    <ModerateReviewButton reviewId={review.id} status="HIDDEN" />
                  ) : null}
                  <Badge tone={review.status === "APPROVED" ? "success" : review.status === "PENDING" ? "warning" : "neutral"}>
                    {review.status === "APPROVED" ? "Tampil" : review.status === "PENDING" ? "Menunggu" : "Disembunyikan"}
                  </Badge>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
