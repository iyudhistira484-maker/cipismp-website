import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, like } from "drizzle-orm";
import { db } from "@/server/db";
import { entitlements, orderItems, orders, products, reviews, seasons, users } from "@/server/db/schema";

import { hashPassword } from "@/server/auth/password";
import { reviewEligibility, setReviewStatus, submitReview, listApprovedReviews, ratingSummary, ReviewError } from "@/server/reviews";
import { databaseUrl, uniqueSuffix } from "./helpers";

const enabled = databaseUrl() !== null;
const suffix = uniqueSuffix();
const rankId = `prd_rev_${suffix}`;
const otherRankId = `prd_rev_${suffix}_2`;
const seasonId = `sn_rev_${suffix}`;
const orderId = `ord_rev_${suffix}`;
const buyerId = `usr_rev_${suffix}`;
const strangerId = `usr_rev_${suffix}_2`;
const PLAYER = `RevUji${suffix.slice(0, 4)}`;

async function cleanup() {
  await db.delete(reviews).where(like(reviews.userId, `usr_rev_${suffix}%`));
  await db.delete(orders).where(like(orders.email, `review-test-${suffix}%`));
  await db.delete(users).where(like(users.id, `usr_rev_${suffix}%`));
  await db.delete(entitlements).where(like(entitlements.productId, `prd_rev_${suffix}%`));
  await db.delete(products).where(like(products.slug, `review-uji-${suffix}%`));
  await db.delete(seasons).where(eq(seasons.id, seasonId));
}

describe.skipIf(!enabled)("ulasan pembeli terverifikasi", () => {
  beforeAll(async () => {
    if (!enabled) return;
    await cleanup();
    const now = new Date();
    const passwordHash = await hashPassword("UlasanUji#2026");

    // Season sendiri berstatus UPCOMING agar tidak bentrok dengan uji lain yang memakai
    // indeks unik "hanya satu season ACTIVE".
    await db.insert(seasons).values({
      id: seasonId,
      name: `Season Review ${suffix}`,
      slug: `season-review-${suffix}`,
      startAt: new Date(now.getTime() - 86_400_000),
      endAt: new Date(now.getTime() + 30 * 86_400_000),
      status: "UPCOMING",
      freezeDays: 3,
    });

    await db.insert(products).values([
      {
        id: rankId,
        slug: `review-uji-${suffix}-satu`,
        type: "RANK",
        name: "Rank Ulasan Satu",
        tagline: "Uji",
        description: "Produk uji ulasan.",
        priceIdr: 20_000,
        tier: 1,
        status: "PUBLISHED",
        perks: [],
      },
      {
        id: otherRankId,
        slug: `review-uji-${suffix}-dua`,
        type: "RANK",
        name: "Rank Ulasan Dua",
        tagline: "Uji",
        description: "Produk uji ulasan tanpa pembelian.",
        priceIdr: 90_000,
        tier: 3,
        status: "PUBLISHED",
        perks: [],
      },
    ]);

    await db.insert(users).values([
      {
        id: buyerId,
        email: `review-test-${suffix}@example.com`,
        username: `revbuyer${suffix.slice(0, 4)}`,
        passwordHash,
        displayName: "Pembeli_Uji",
        emailVerifiedAt: now,
      },
      {
        id: strangerId,
        email: `review-test-${suffix}-2@example.com`,
        username: `revstranger${suffix.slice(0, 4)}`,
        passwordHash,
        emailVerifiedAt: now,
      },
    ]);

    // Order PAID langsung: yang diuji adalah aturan ulasan, bukan alur checkout.
    await db.insert(orders).values({
      id: orderId,
      orderNumber: `REV-${suffix.toUpperCase()}`,
      publicToken: `tokrev${suffix}`,
      userId: buyerId,
      email: `review-test-${suffix}@example.com`,
      mcUuid: "00000000-0000-4000-8000-000000000001",
      mcName: PLAYER,
      seasonId,
      status: "DELIVERED",
      subtotalIdr: 20_000,
      totalIdr: 20_000,
      expiresAt: new Date(now.getTime() + 86_400_000),
    });
    await db.insert(orderItems).values({
      id: `oit_rev_${suffix}`,
      orderId,
      productId: rankId,
      type: "RANK",
      nameSnapshot: "Rank Ulasan Satu",
      unitPriceIdr: 20_000,
      quantity: 1,
      lineTotalIdr: 20_000,
      targetUuid: "00000000-0000-4000-8000-000000000001",
      targetName: PLAYER,
    });
  }, 60_000);

  afterAll(async () => {
    if (!enabled) return;
    await cleanup();
  });

  it("menolak ulasan dari akun tanpa pembelian", async () => {
    const eligibility = await reviewEligibility(strangerId, rankId);
    expect(eligibility.canReview).toBe(false);
    expect(eligibility.reason).toBe("NOT_PURCHASED");
    await expect(submitReview({ userId: strangerId, productId: rankId, rating: 5, body: "Mantap sekali rank ini!" })).rejects.toThrow(
      ReviewError,
    );
  });

  it("pembeli bisa mengulas, ulasan masuk antrean moderasi", async () => {
    const eligibility = await reviewEligibility(buyerId, rankId);
    expect(eligibility.canReview).toBe(true);

    const created = await submitReview({
      userId: buyerId,
      productId: rankId,
      rating: 5,
      body: "Rank ini bikin saya dapat /fly dan /hat. Worth it banget!",
    });
    const row = await db.query.reviews.findFirst({ where: eq(reviews.id, created.id) });
    expect(row?.status).toBe("PENDING");
    expect(row?.orderId).not.toBeNull();

    expect(await listApprovedReviews(rankId)).toHaveLength(0);
    expect((await ratingSummary(rankId)).count).toBe(0);
  });

  it("menolak ulasan ganda untuk produk yang sama", async () => {
    await expect(
      submitReview({ userId: buyerId, productId: rankId, rating: 4, body: "Ulasan kedua yang seharusnya ditolak." }),
    ).rejects.toThrow(/sudah mengulas/i);
  });

  it("menolak rating di luar 1-5 dan ulasan terlalu pendek", async () => {
    await expect(
      submitReview({ userId: buyerId, productId: otherRankId, rating: 9, body: "Rating tidak valid tapi panjang." }),
    ).rejects.toThrow(/1 sampai 5/);
  });

  it("ulasan yang disetujui tampil dengan nama disamarkan dan ringkasan rata-rata", async () => {
    const row = await db.query.reviews.findFirst({ where: and(eq(reviews.userId, buyerId), eq(reviews.productId, rankId)) });
    await setReviewStatus(row!.id, "APPROVED");

    const list = await listApprovedReviews(rankId);
    expect(list).toHaveLength(1);
    expect(list[0]?.verified).toBe(true);
    expect(list[0]?.authorName).toBe("Pembeli");

    const summary = await ratingSummary(rankId);
    expect(summary.count).toBe(1);
    expect(summary.average).toBe(5);
    expect(summary.buckets[4]).toBe(1);
  });

  it("ulasan yang disembunyikan hilang dari halaman produk", async () => {
    const row = await db.query.reviews.findFirst({ where: and(eq(reviews.userId, buyerId), eq(reviews.productId, rankId)) });
    await setReviewStatus(row!.id, "HIDDEN");
    expect(await listApprovedReviews(rankId)).toHaveLength(0);
    expect((await ratingSummary(rankId)).count).toBe(0);
  });
});
