import { and, avg, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import { orderItems, orders, products, reviews, users } from "./db/schema";
import { ids } from "./ids";

export class ReviewError extends Error {}

export interface ProductReview {
  id: string;
  rating: number;
  body: string;
  authorName: string;
  verified: boolean;
  createdAt: Date;
}

export interface RatingSummary {
  count: number;
  average: number;
  /** jumlah bintang 1..5, index 0 = bintang 1 */
  buckets: number[];
}

const PAID_STATUSES = ["PAID", "DELIVERING", "DELIVERED", "DISPUTED"] as const;

/** Pembelian sukses (bukan hadiah) untuk produk tertentu — dasar label "Pembelian terverifikasi". */
async function findPurchase(userId: string, productId: string) {
  const rows = await db
    .select({ orderId: orderItems.orderId, createdAt: orders.createdAt })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(
      and(
        eq(orders.userId, userId),
        eq(orderItems.productId, productId),
        inArray(orders.status, [...PAID_STATUSES]),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export interface ReviewEligibility {
  canReview: boolean;
  reason?: "LOGIN" | "NOT_PURCHASED" | "ALREADY_REVIEWED";
  existing?: { id: string; status: "PENDING" | "APPROVED" | "HIDDEN"; rating: number; body: string };
}

export async function reviewEligibility(userId: string | null, productId: string): Promise<ReviewEligibility> {
  if (!userId) return { canReview: false, reason: "LOGIN" };

  const existing = await db
    .select({ id: reviews.id, status: reviews.status, rating: reviews.rating, body: reviews.body })
    .from(reviews)
    .where(and(eq(reviews.userId, userId), eq(reviews.productId, productId)))
    .limit(1);
  if (existing[0]) {
    return {
      canReview: false,
      reason: "ALREADY_REVIEWED",
      existing: { id: existing[0].id, status: existing[0].status, rating: existing[0].rating, body: existing[0].body },
    };
  }

  const purchase = await findPurchase(userId, productId);
  if (!purchase) return { canReview: false, reason: "NOT_PURCHASED" };
  return { canReview: true };
}

function validateReviewContent(ratingInput: number, bodyInput: string): { rating: number; body: string } {
  const rating = Math.trunc(ratingInput);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new ReviewError("Pilih rating 1 sampai 5 bintang.");
  }
  const body = bodyInput.trim();
  if (body.length < 15) throw new ReviewError("Ulasan minimal 15 karakter agar bermanfaat.");
  if (body.length > 1200) throw new ReviewError("Ulasan maksimal 1200 karakter.");
  return { rating, body };
}

export async function submitReview(input: {
  userId: string;
  productId: string;
  rating: number;
  body: string;
  authorName?: string;
}): Promise<{ id: string }> {
  const { rating, body } = validateReviewContent(input.rating, input.body);
  const eligibility = await reviewEligibility(input.userId, input.productId);
  if (!eligibility.canReview) {
    if (eligibility.reason === "ALREADY_REVIEWED") throw new ReviewError("Kamu sudah mengulas produk ini.");
    if (eligibility.reason === "NOT_PURCHASED") {
      throw new ReviewError("Ulasan hanya terbuka untuk pembeli produk ini.");
    }
    throw new ReviewError("Masuk ke akunmu dulu untuk menulis ulasan.");
  }

  const purchase = await findPurchase(input.userId, input.productId);
  const id = ids.review();
  await db.insert(reviews).values({
    id,
    productId: input.productId,
    userId: input.userId,
    orderId: purchase?.orderId ?? null,
    rating,
    body,
  });
  return { id };
}

/** Pemilik boleh mengoreksi ulasannya; setiap perubahan kembali ke antrean moderasi. */
export async function updateOwnReview(input: {
  reviewId: string;
  userId: string;
  rating: number;
  body: string;
}): Promise<{ id: string; productId: string; before: { status: "PENDING" | "APPROVED" | "HIDDEN"; rating: number } }> {
  const { rating, body } = validateReviewContent(input.rating, input.body);
  const existing = await db.query.reviews.findFirst({
    where: and(eq(reviews.id, input.reviewId), eq(reviews.userId, input.userId)),
  });
  if (!existing) throw new ReviewError("Ulasan tidak ditemukan atau bukan milik akunmu.");

  const updated = await db
    .update(reviews)
    .set({ rating, body, status: "PENDING", updatedAt: new Date() })
    .where(and(eq(reviews.id, input.reviewId), eq(reviews.userId, input.userId)))
    .returning({ id: reviews.id });
  if (updated.length === 0) throw new ReviewError("Ulasan tidak ditemukan atau bukan milik akunmu.");

  return { id: existing.id, productId: existing.productId, before: { status: existing.status, rating: existing.rating } };
}

export async function listApprovedReviews(productId: string, limit = 12): Promise<ProductReview[]> {
  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      body: reviews.body,
      orderId: reviews.orderId,
      updatedAt: reviews.updatedAt,
      username: users.username,
      displayName: users.displayName,
    })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.userId))
    .where(and(eq(reviews.productId, productId), eq(reviews.status, "APPROVED")))
    .orderBy(desc(reviews.updatedAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    rating: row.rating,
    body: row.body,
    authorName: maskName(row.displayName ?? row.username),
    verified: row.orderId !== null,
    createdAt: row.updatedAt,
  }));
}

export interface PublicReview extends ProductReview {
  productId: string;
  productType: "RANK" | "KIT";
  productName: string;
  productSlug: string;
}

export interface PublicReviewFeed {
  reviews: PublicReview[];
  total: number;
}

const visibleReviewFilter = and(
  eq(reviews.status, "APPROVED"),
  eq(products.status, "PUBLISHED"),
  isNull(products.deletedAt),
);

/** Ulasan publik terbaru, hanya untuk produk terbit dan yang belum dihapus. */
export async function listPublicReviews(limit = 20, offset = 0): Promise<PublicReviewFeed> {
  const safeLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
  const safeOffset = Math.max(0, Math.trunc(offset));
  const [rows, totals] = await Promise.all([
    db
      .select({
        id: reviews.id,
        productId: products.id,
        productType: products.type,
        productName: products.name,
        productSlug: products.slug,
        rating: reviews.rating,
        body: reviews.body,
        orderId: reviews.orderId,
        updatedAt: reviews.updatedAt,
        username: users.username,
        displayName: users.displayName,
      })
      .from(reviews)
      .innerJoin(products, eq(products.id, reviews.productId))
      .innerJoin(users, eq(users.id, reviews.userId))
      .where(visibleReviewFilter)
      .orderBy(desc(reviews.updatedAt))
      .limit(safeLimit)
      .offset(safeOffset),
    db
      .select({ total: count() })
      .from(reviews)
      .innerJoin(products, eq(products.id, reviews.productId))
      .where(visibleReviewFilter),
  ]);

  return {
    reviews: rows.map((row) => ({
      id: row.id,
      productId: row.productId,
      productType: row.productType,
      productName: row.productName,
      productSlug: row.productSlug,
      rating: row.rating,
      body: row.body,
      authorName: maskName(row.displayName ?? row.username),
      verified: row.orderId !== null,
      createdAt: row.updatedAt,
    })),
    total: Number(totals[0]?.total ?? 0),
  };
}

/** Ringkasan seluruh ulasan yang tampil di katalog publik. */
export async function publicReviewSummary(): Promise<RatingSummary> {
  const rows = await db
    .select({ rating: reviews.rating, total: count() })
    .from(reviews)
    .innerJoin(products, eq(products.id, reviews.productId))
    .where(visibleReviewFilter)
    .groupBy(reviews.rating);
  const buckets = [0, 0, 0, 0, 0];
  let total = 0;
  let sum = 0;
  for (const row of rows) {
    const index = Math.min(Math.max(row.rating, 1), 5) - 1;
    buckets[index] = (buckets[index] ?? 0) + Number(row.total);
    total += Number(row.total);
    sum += row.rating * Number(row.total);
  }
  return { count: total, average: total === 0 ? 0 : Math.round((sum / total) * 10) / 10, buckets };
}

export interface OwnReview {
  id: string;
  productId: string;
  productType: "RANK" | "KIT";
  productName: string;
  productSlug: string;
  rating: number;
  body: string;
  status: "PENDING" | "APPROVED" | "HIDDEN";
  updatedAt: Date;
}

/** Status apa pun hanya ditampilkan kepada pemilik review yang sedang login. */
export async function listOwnReviews(userId: string, limit = 50): Promise<OwnReview[]> {
  const rows = await db
    .select({
      id: reviews.id,
      productId: products.id,
      productType: products.type,
      productName: products.name,
      productSlug: products.slug,
      rating: reviews.rating,
      body: reviews.body,
      status: reviews.status,
      updatedAt: reviews.updatedAt,
    })
    .from(reviews)
    .innerJoin(products, eq(products.id, reviews.productId))
    .where(eq(reviews.userId, userId))
    .orderBy(desc(reviews.updatedAt))
    .limit(Math.max(1, Math.min(100, Math.trunc(limit))));
  return rows;
}

export async function ratingSummary(productId: string): Promise<RatingSummary> {
  const rows = await db
    .select({ rating: reviews.rating, total: count() })
    .from(reviews)
    .where(and(eq(reviews.productId, productId), eq(reviews.status, "APPROVED")))
    .groupBy(reviews.rating);

  const buckets = [0, 0, 0, 0, 0];
  let total = 0;
  let sum = 0;
  for (const row of rows) {
    const index = Math.min(Math.max(row.rating, 1), 5) - 1;
    buckets[index] = (buckets[index] ?? 0) + Number(row.total);
    total += Number(row.total);
    sum += row.rating * Number(row.total);
  }
  return { count: total, average: total === 0 ? 0 : Math.round((sum / total) * 10) / 10, buckets };
}

/** Rating untuk banyak produk sekaligus (dipakai daftar katalog). */
export async function ratingMap(productIds: string[]): Promise<Map<string, { count: number; average: number }>> {
  const map = new Map<string, { count: number; average: number }>();
  if (productIds.length === 0) return map;
  const rows = await db
    .select({ productId: reviews.productId, total: count(), average: avg(reviews.rating) })
    .from(reviews)
    .where(and(inArray(reviews.productId, productIds), eq(reviews.status, "APPROVED")))
    .groupBy(reviews.productId);
  for (const row of rows) {
    map.set(row.productId, {
      count: Number(row.total),
      average: Math.round(Number(row.average ?? 0) * 10) / 10,
    });
  }
  return map;
}

export interface ModerationReview {
  id: string;
  rating: number;
  body: string;
  status: "PENDING" | "APPROVED" | "HIDDEN";
  createdAt: Date;
  productName: string;
  productSlug: string;
  authorName: string;
  orderNumber: string | null;
}

export async function listReviewsForModeration(status?: "PENDING" | "APPROVED" | "HIDDEN"): Promise<ModerationReview[]> {
  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      body: reviews.body,
      status: reviews.status,
      createdAt: reviews.createdAt,
      productName: products.name,
      productSlug: products.slug,
      username: users.username,
      displayName: users.displayName,
      orderNumber: orders.orderNumber,
    })
    .from(reviews)
    .innerJoin(products, eq(products.id, reviews.productId))
    .innerJoin(users, eq(users.id, reviews.userId))
    .leftJoin(orders, eq(orders.id, reviews.orderId))
    .where(status ? eq(reviews.status, status) : sql`true`)
    .orderBy(desc(reviews.createdAt))
    .limit(200);

  return rows.map((row) => ({
    id: row.id,
    rating: row.rating,
    body: row.body,
    status: row.status,
    createdAt: row.createdAt,
    productName: row.productName,
    productSlug: row.productSlug,
    authorName: `${row.displayName ?? row.username}`,
    orderNumber: row.orderNumber,
  }));
}

export async function setReviewStatus(id: string, status: "APPROVED" | "HIDDEN"): Promise<void> {
  const updated = await db.update(reviews).set({ status, updatedAt: new Date() }).where(eq(reviews.id, id)).returning({ id: reviews.id });
  if (updated.length === 0) throw new ReviewError("Ulasan tidak ditemukan.");
}

export async function reviewCounts(): Promise<Record<"PENDING" | "APPROVED" | "HIDDEN", number>> {
  const rows = await db.select({ status: reviews.status, total: count() }).from(reviews).groupBy(reviews.status);
  const result = { PENDING: 0, APPROVED: 0, HIDDEN: 0 };
  for (const row of rows) result[row.status] = Number(row.total);
  return result;
}

/** Nama penampil disamarkan: "Budi_S" → "Budi S.", "steve" → "steve". */
export function maskName(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return "Pembeli";
  const first = cleaned.split(/[\s_.-]+/)[0] ?? cleaned;
  return first.length <= 2 ? `${first}***` : `${first.slice(0, 12)}`;
}
