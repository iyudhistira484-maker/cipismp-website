import { createHash } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, like } from "drizzle-orm";
import { db } from "@/server/db";
import { jobs, orders, paymentCredentials, paymentEvents, payments, seasons } from "@/server/db/schema";
import { saveProviderConfig } from "@/server/payments";
import { handleProviderWebhook } from "@/server/payments/webhook";
import { databaseUrl, uniqueSuffix } from "./helpers";

const enabled = databaseUrl() !== null;
const suffix = uniqueSuffix();
const orderId = `midtrans-order-${suffix}`;
const orderNumber = `MID-TEST-${suffix}`;
const seasonId = `midtrans-season-${suffix}`;
const key = "midtrans-signature-test";
let previousCredential: typeof paymentCredentials.$inferSelect | undefined;

function notification(status: string, transactionId = `forged-${suffix}`) {
  const signature = createHash("sha512").update(`${orderNumber}20025000.00${key}`).digest("hex");
  return JSON.stringify({ order_id: orderNumber, status_code: "200", gross_amount: "25000.00", transaction_id: transactionId, transaction_status: status, fraud_status: "accept", signature_key: signature });
}
function response(status: string, override: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ order_id: orderNumber, transaction_id: `actual-${suffix}`, gross_amount: "25000.00", transaction_status: status, payment_type: "qris", ...override }), { status: 200 });
}

describe.skipIf(!enabled)("Midtrans webhook memeriksa status otoritatif", () => {
  beforeAll(async () => {
    previousCredential = await db.query.paymentCredentials.findFirst({ where: eq(paymentCredentials.provider, "MIDTRANS") });
    await saveProviderConfig({ provider: "MIDTRANS", mode: "sandbox", enabled: true, updatedBy: "test", config: { serverKey: "server-key-test", clientKey: "", signatureSecretKey: key } });
    await db.insert(seasons).values({ id: seasonId, name: "Midtrans test", slug: `midtrans-test-${suffix}`, startAt: new Date(), endAt: new Date(Date.now() + 86_400_000), status: "UPCOMING" });
    await db.insert(orders).values({ id: orderId, orderNumber, publicToken: `midtrans-token-${suffix}`, email: "test@example.test", mcUuid: "player-uuid", mcName: "Player", seasonId, subtotalIdr: 25000, totalIdr: 25000, provider: "MIDTRANS", expiresAt: new Date(Date.now() + 3600000) });
    await db.insert(payments).values({ id: `midtrans-payment-${suffix}`, orderId, provider: "MIDTRANS", providerRef: `snap-token-${suffix}`, status: "PENDING", amountIdr: 25000, expiresAt: new Date(Date.now() + 3600000) });
  });
  afterEach(() => vi.unstubAllGlobals());
  afterAll(async () => {
    if (!enabled) return;
    await db.delete(paymentEvents).where(and(eq(paymentEvents.provider, "MIDTRANS"), like(paymentEvents.dedupeKey, `%${suffix}%`)));
    await db.delete(jobs).where(eq(jobs.dedupeKey, `email-paid:${orderId}`));
    await db.delete(payments).where(eq(payments.orderId, orderId));
    await db.delete(orders).where(eq(orders.id, orderId));
    await db.delete(seasons).where(eq(seasons.id, seasonId));
    await db.delete(paymentCredentials).where(eq(paymentCredentials.provider, "MIDTRANS"));
    if (previousCredential) await db.insert(paymentCredentials).values(previousCredential);
  });

  it("signature salah ditolak tanpa memanggil API status", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const payload = JSON.parse(notification("settlement"));
    payload.signature_key = "invalid";
    const outcome = await handleProviderWebhook("MIDTRANS", JSON.stringify(payload), {}, "127.0.0.1");
    expect(outcome.httpStatus).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mengabaikan status dan transaction ID palsu meskipun signature valid", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response("pending"));
    vi.stubGlobal("fetch", fetchMock);
    const outcome = await handleProviderWebhook("MIDTRANS", notification("settlement"), {}, "127.0.0.1");
    expect(outcome.result).toBe("pending-ignored");
    expect((await db.query.orders.findFirst({ where: eq(orders.id, orderId) }))?.status).toBe("PENDING");
    const events = await db.query.paymentEvents.findMany({ where: eq(paymentEvents.orderId, orderId) });
    expect(events[0]?.dedupeKey).toContain(`actual-${suffix}:pending`);
    expect(events[0]?.eventType).toBe("notification:pending");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tidak mencatat atau memenuhi ketika API gagal atau respons tidak cocok, agar dapat diulang", async () => {
    const before = await db.query.paymentEvents.findMany({ where: eq(paymentEvents.orderId, orderId) });
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("error", { status: 503 }))
      .mockResolvedValueOnce(response("settlement", { order_id: "other-order" }))
      .mockResolvedValueOnce(response("settlement", { gross_amount: "25000.99" }))
      .mockResolvedValueOnce(response("settlement", { gross_amount: "24000.00" }));
    vi.stubGlobal("fetch", fetchMock);
    for (let i = 0; i < 4; i++) await expect(handleProviderWebhook("MIDTRANS", notification("settlement"), {}, "127.0.0.1")).rejects.toThrow();
    expect((await db.query.orders.findFirst({ where: eq(orders.id, orderId) }))?.status).toBe("PENDING");
    expect((await db.query.paymentEvents.findMany({ where: eq(paymentEvents.orderId, orderId) })).length).toBe(before.length);
  });

  it("memenuhi sekali setelah API menyatakan settlement, lalu mengabaikan duplikat", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => response("settlement")));
    expect((await handleProviderWebhook("MIDTRANS", notification("settlement"), {}, "127.0.0.1")).result).toBe("fulfilled");
    expect((await handleProviderWebhook("MIDTRANS", notification("deny", "changed-id"), {}, "127.0.0.1")).result).toBe("duplicate-event-ignored");
    expect((await db.query.payments.findFirst({ where: eq(payments.orderId, orderId) }))?.status).toBe("PAID");
  });
});
