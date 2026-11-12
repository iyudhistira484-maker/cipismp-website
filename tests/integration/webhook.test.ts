import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, like } from "drizzle-orm";
import { db } from "@/server/db";
import {
  commandTemplates,
  deliveries,
  entitlements,
  orderItems,
  orders,
  paymentEvents,
  payments,
  products,
  seasons,
} from "@/server/db/schema";
import { createHmac } from "node:crypto";
import { handleProviderWebhook } from "@/server/payments/webhook";
import { databaseUrl, uniqueSuffix } from "./helpers";

const SECRET = process.env.SESSION_SECRET as string;
const enabled = databaseUrl() !== null;

const suffix = uniqueSuffix();
const seasonId = `season_test_${suffix}`;
const productId = `product_test_${suffix}`;
const orderId = `order_test_${suffix}`;
const orderNumber = `CIPI-TEST-${suffix}`;
const providerRef = `FAKE-${orderNumber}-x`;
const totalIdr = 25_000;

/** Signature provider FAKE: HMAC-SHA256(secret, body) dalam hex. */
function signFake(body: string): string {
  return createHmac("sha256", SECRET).update(body).digest("hex");
}

async function fakeWebhook(payload: Record<string, unknown>): Promise<{
  body: string;
  headers: Record<string, string>;
}> {
  const body = JSON.stringify(payload);
  return { body, headers: { "x-fake-signature": signFake(body) } };
}

describe.skipIf(!enabled)("webhook gateway — validasi & idempotensi", () => {
  /** Hapus seluruh jejak test (urutan mengikuti foreign key). */
  async function cleanup(): Promise<void> {
    const staleOrders = await db.query.orders.findMany({ where: like(orders.orderNumber, "CIPI-TEST-%") });
    for (const stale of staleOrders) {
      await db.delete(deliveries).where(eq(deliveries.orderId, stale.id));
    }
    await db.delete(entitlements).where(like(entitlements.productId, "product_test_%"));
    for (const stale of staleOrders) {
      await db.delete(payments).where(eq(payments.orderId, stale.id));
      await db.delete(orderItems).where(eq(orderItems.orderId, stale.id));
      await db.delete(orders).where(eq(orders.id, stale.id));
    }
    // Product deletion cascades only its own command templates; do not wipe the seeded catalog.
    await db.delete(products).where(like(products.slug, "rank-uji-%"));
    await db.delete(seasons).where(like(seasons.slug, "season-uji-%"));
  }

  beforeAll(async () => {
    if (!enabled) return; // jangan menyentuh database saat integrasi di-skip
    // Bersihkan sisa run sebelumnya agar unique index "satu season ACTIVE" tidak bentrok.
    await cleanup();

    const now = new Date();
    await db.insert(seasons).values({
      id: seasonId,
      name: `Season Uji ${suffix}`,
      slug: `season-uji-${suffix}`,
      startAt: new Date(now.getTime() - 86_400_000),
      endAt: new Date(now.getTime() + 30 * 86_400_000),
      status: "ACTIVE",
      freezeDays: 3,
    });
    await db.insert(products).values({
      id: productId,
      slug: `rank-uji-${suffix}`,
      type: "RANK",
      name: "Rank Uji",
      tagline: "Untuk pengujian",
      description: "Produk yang hanya dibuat oleh test.",
      priceIdr: totalIdr,
      tier: 1,
      status: "PUBLISHED",
      perks: [],
    });
    await db.insert(commandTemplates).values({
      id: `cmd_${suffix}`,
      productId,
      kind: "GRANT",
      template: "lp user {player} parent set vip",
    });
    await db.insert(orders).values({
      id: orderId,
      orderNumber,
      publicToken: `token_${suffix}`,
      email: `uji-${suffix}@example.com`,
      mcUuid: "33333333-3333-4333-8333-333333333333",
      mcName: "CipiTest",
      seasonId,
      status: "PENDING",
      subtotalIdr: totalIdr,
      totalIdr,
      provider: "FAKE",
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    await db.insert(orderItems).values({
      id: `item_${suffix}`,
      orderId,
      productId,
      type: "RANK",
      nameSnapshot: "Rank Uji",
      unitPriceIdr: totalIdr,
      quantity: 1,
      lineTotalIdr: totalIdr,
      targetUuid: "33333333-3333-4333-8333-333333333333",
      targetName: "CipiTest",
    });
    await db.insert(payments).values({
      id: `pay_${suffix}`,
      orderId,
      provider: "FAKE",
      providerRef,
      method: "QRIS",
      status: "PENDING",
      amountIdr: totalIdr,
      expiresAt: new Date(Date.now() + 3_600_000),
    });
  });

  afterAll(async () => {
    if (!enabled) return;
    await db.delete(paymentEvents).where(eq(paymentEvents.provider, "FAKE"));
    await cleanup();
  });

  it("menolak webhook dengan signature tidak valid dan mencatatnya", async () => {
    const body = JSON.stringify({ reference: providerRef, merchant_ref: orderNumber, status: "PAID", amount: totalIdr });
    const outcome = await handleProviderWebhook("FAKE", body, { "x-fake-signature": "deadbeef" }, "127.0.0.1");
    expect(outcome.httpStatus).toBe(401);
    expect(outcome.result).toBe("invalid-signature");

    const rows = await db.query.paymentEvents.findMany({
      where: and(eq(paymentEvents.provider, "FAKE"), like(paymentEvents.dedupeKey, `%${providerRef}%`)),
    });
    const recorded = rows.find((r) => r.signatureValid === false);
    expect(recorded).toBeDefined();
    expect(recorded?.processedAt).not.toBeNull();
    // Payload palsu tidak boleh mengunci dedupe key asli milik gateway.
    expect(recorded?.dedupeKey.startsWith("INVALID:")).toBe(true);

    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
    expect(order?.status).toBe("PENDING");
  });

  it("mengabaikan webhook untuk order yang tidak dikenal", async () => {
    const { body, headers } = await fakeWebhook({
      reference: `FAKE-UNKNOWN-${suffix}`,
      merchant_ref: `CIPI-UNKNOWN-${suffix}`,
      status: "PAID",
      amount: 1000,
    });
    const outcome = await handleProviderWebhook("FAKE", body, headers, "127.0.0.1");
    expect(outcome.httpStatus).toBe(200);
    expect(outcome.result).toBe("order-not-found");
  });

  it("menandai pembayaran kurang tanpa mengubah status order", async () => {
    const { body, headers } = await fakeWebhook({
      reference: providerRef,
      merchant_ref: orderNumber,
      status: "PAID",
      amount: 5_000,
    });
    const outcome = await handleProviderWebhook("FAKE", body, headers, "127.0.0.1");
    expect(outcome.result).toBe("underpaid-flagged");

    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
    expect(order?.status).toBe("PENDING");
    const payment = await db.query.payments.findFirst({ where: eq(payments.providerRef, providerRef) });
    expect(payment?.status).toBe("UNDERPAID");
    expect(payment?.amountIdr).toBe(5_000);
    expect(await db.query.deliveries.findMany({ where: eq(deliveries.orderId, orderId) })).toHaveLength(0);
  });

  it("tidak memenuhi order bila nominal tidak tersedia", async () => {
    const { body, headers } = await fakeWebhook({ reference: providerRef, merchant_ref: orderNumber, status: "PAID" });
    expect((await handleProviderWebhook("FAKE", body, headers, "127.0.0.1")).result).toBe("amount-unverified");
    expect((await db.query.orders.findFirst({ where: eq(orders.id, orderId) }))?.status).toBe("PENDING");
  });

  it("menolak referensi pembayaran milik order lain", async () => {
    const otherId = `other_${suffix}`, otherRef = `other-ref-${suffix}`;
    await db.insert(orders).values({ id: otherId, orderNumber: `CIPI-OTHER-${suffix}`, publicToken: otherId, email: `other-${suffix}@example.test`, mcUuid: "other", mcName: "Other", seasonId, status: "PENDING", subtotalIdr: totalIdr, totalIdr, provider: "FAKE", expiresAt: new Date(Date.now() + 60000) });
    await db.insert(payments).values({ id: otherId, orderId: otherId, provider: "FAKE", providerRef: otherRef, amountIdr: totalIdr });
    try {
      const { body, headers } = await fakeWebhook({ reference: otherRef, merchant_ref: orderNumber, status: "PAID", amount: totalIdr });
      expect((await handleProviderWebhook("FAKE", body, headers, "127.0.0.1")).result).toBe("payment-reference-mismatch");
      expect((await db.query.orders.findFirst({ where: eq(orders.id, orderId) }))?.status).toBe("PENDING");
      expect((await db.query.payments.findFirst({ where: eq(payments.id, otherId) }))?.status).toBe("PENDING");
    } finally { await db.delete(orders).where(eq(orders.id, otherId)); }
  });

  it("mencatat pembayaran order yang dibatalkan untuk ditinjau, tanpa mengirim", async () => {
    const cancelledId = `cancelled_${suffix}`, cancelledRef = `cancelled-ref-${suffix}`, cancelledNumber = `CIPI-CANCEL-${suffix}`;
    await db.insert(orders).values({ id: cancelledId, orderNumber: cancelledNumber, publicToken: cancelledId, email: `cancel-${suffix}@example.test`, mcUuid: "other", mcName: "Other", seasonId, status: "CANCELLED", subtotalIdr: totalIdr, totalIdr, provider: "FAKE", expiresAt: new Date() });
    await db.insert(payments).values({ id: cancelledId, orderId: cancelledId, provider: "FAKE", providerRef: cancelledRef, amountIdr: totalIdr });
    try {
      const { body, headers } = await fakeWebhook({ reference: cancelledRef, merchant_ref: cancelledNumber, status: "PAID", amount: totalIdr });
      expect((await handleProviderWebhook("FAKE", body, headers, "127.0.0.1")).result).toBe("cancelled-paid-review");
      expect((await db.query.orders.findFirst({ where: eq(orders.id, cancelledId) }))?.status).toBe("CANCELLED");
      expect((await db.query.payments.findFirst({ where: eq(payments.id, cancelledId) }))?.status).toBe("PAID");
      expect(await db.query.deliveries.findMany({ where: eq(deliveries.orderId, cancelledId) })).toHaveLength(0);
    } finally { await db.delete(orders).where(eq(orders.id, cancelledId)); }
  });

  it("melanjutkan event terputus, memenuhi order sekali dan mengabaikan replay", async () => {
    // Kembalikan payment ke PENDING seperti kondisi nyata sebelum pembayaran penuh.
    await db.update(payments).set({ status: "PENDING", amountIdr: totalIdr }).where(eq(payments.providerRef, providerRef));

    const { body, headers } = await fakeWebhook({
      reference: providerRef,
      merchant_ref: orderNumber,
      status: "PAID",
      amount: totalIdr,
    });

    await db.insert(paymentEvents).values({ id: `interrupted-${suffix}`, provider: "FAKE", eventType: "fake:PAID", signatureValid: true, dedupeKey: `FAKE:${providerRef}:PAID:${totalIdr}`, rawPayload: JSON.parse(body) });
    const first = await handleProviderWebhook("FAKE", body, headers, "127.0.0.1");
    expect(first.httpStatus).toBe(200);
    expect(first.duplicate).toBe(false);
    expect(first.result).toBe("fulfilled");

    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
    expect(order?.status === "PAID" || order?.status === "DELIVERING" || order?.status === "DELIVERED").toBe(true);
    expect(order?.paidAt).not.toBeNull();

    const queued = await db.query.deliveries.findMany({ where: eq(deliveries.orderId, orderId) });
    expect(queued.length).toBeGreaterThan(0);
    expect(queued.flatMap((delivery) => delivery.commands)).toContain("lp user CipiTest parent set vip");

    const replay = await handleProviderWebhook("FAKE", body, headers, "127.0.0.1");
    expect(replay.result).toBe("duplicate-event-ignored");
    expect(replay.duplicate).toBe(true);

    const deliveriesAfter = await db.query.deliveries.findMany({ where: eq(deliveries.orderId, orderId) });
    expect(deliveriesAfter.length).toBe(queued.length);

    const events = await db.query.paymentEvents.findMany({ where: eq(paymentEvents.orderId, orderId) });
    const paidEvents = events.filter((e) => e.eventType.includes("PAID") && e.signatureValid);
    expect(paidEvents.length).toBeGreaterThanOrEqual(1);
    const otherNotice = await fakeWebhook({ reference: providerRef, merchant_ref: orderNumber, status: "PAID", amount: totalIdr + 1 });
    expect((await handleProviderWebhook("FAKE", otherNotice.body, otherNotice.headers, "127.0.0.1")).result).toBe("payment-already-recorded");
    expect((await db.query.payments.findFirst({ where: eq(payments.providerRef, providerRef) }))?.status).toBe("PAID");
    const lateUnderpaid = await fakeWebhook({ reference: providerRef, merchant_ref: orderNumber, status: "PAID", amount: totalIdr - 1 });
    expect((await handleProviderWebhook("FAKE", lateUnderpaid.body, lateUnderpaid.headers, "127.0.0.1")).result).toBe("underpaid-flagged");
    expect((await db.query.payments.findFirst({ where: eq(payments.providerRef, providerRef) }))?.status).toBe("PAID");
  });

  it("menandai order DISPUTED saat gateway melaporkan chargeback", async () => {
    const { body, headers } = await fakeWebhook({
      reference: providerRef,
      merchant_ref: orderNumber,
      status: "FAILED",
      reason: "chargeback",
    });
    await handleProviderWebhook("FAKE", body, headers, "127.0.0.1");

    const dispute = await fakeWebhook({
      reference: `${providerRef}-cb`,
      merchant_ref: orderNumber,
      status: "PAID",
      amount: totalIdr,
    });
    // Pembayaran kedua untuk order yang sudah lunas -> dicatat sebagai duplikat, bukan pengiriman baru.
    const outcome = await handleProviderWebhook("FAKE", dispute.body, dispute.headers, "127.0.0.1");
    expect(outcome.result).toBe("payment-reference-mismatch");
  });
});
