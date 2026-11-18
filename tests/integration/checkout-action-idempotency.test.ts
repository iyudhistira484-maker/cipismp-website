import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { databaseUrl, uniqueSuffix } from "./helpers";

const mocks = vi.hoisted(() => ({ create: vi.fn(), clear: vi.fn(), lines: [] as any[], cartId: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("@/server/csrf", () => ({ assertSameOrigin: () => {}, clientIp: () => "127.0.0.1" }));
vi.mock("@/server/rate-limit", () => ({ enforceRateLimit: async () => {}, RateLimitError: class extends Error {} }));
vi.mock("@/server/cart", () => ({
  getCartIdentity: async () => ({ cartId: mocks.cartId, userId: null, guestKey: "test" }),
  getCartLines: async () => mocks.lines,
  clearCartLines: mocks.clear,
}));
vi.mock("@/server/settings", () => ({ getSettings: async () => ({ legal: { tosVersion: "1", privacyVersion: "1", salesVersion: "1" } }) }));
vi.mock("@/server/auth/guard", () => ({ getViewer: async () => null }));
vi.mock("@/server/auth/session", () => ({ getCurrentSession: async () => null }));
vi.mock("@/server/orders", () => ({
  createOrder: mocks.create,
  CheckoutError: class extends Error { fields?: Record<string, string> },
  findOrderForLookup: vi.fn(),
}));

import { checkoutAction } from "@/app/actions/checkout";
import { checkoutAttemptKey, findCheckoutAttempt } from "@/server/checkout-attempts";
import { db } from "@/server/db";
import { checkoutAttempts, orders, seasons } from "@/server/db/schema";

const enabled = databaseUrl() !== null;
const suffix = uniqueSuffix();
const seasonId = `attempt-action-season-${suffix}`;
const orderId = `attempt-action-order-${suffix}`;
const token = `attempt-action-token-${suffix}`;

function form(key: string) {
  const data = new FormData();
  for (const [name, value] of Object.entries({ attemptKey: key, mcName: "Player", email: "player@example.test", provider: "FAKE", terms: "on", noRefund: "on" })) data.set(name, value);
  return data;
}

describe.skipIf(!enabled)("checkout action: pengulangan dan kegagalan gateway", () => {
  beforeAll(async () => {
    mocks.cartId = `action-cart-${suffix}`;
    mocks.lines = [{ id: "line1", productId: "product1", quantity: 1, targetUuid: null, targetName: null, isGift: false, addedAt: new Date() }];
    await db.insert(seasons).values({ id: seasonId, name: "Idempotency", slug: `attempt-action-${suffix}`, startAt: new Date(), endAt: new Date(Date.now() + 86400000), status: "UPCOMING" });
  });
  afterAll(async () => {
    await db.delete(checkoutAttempts).where(eq(checkoutAttempts.cartId, mocks.cartId));
    await db.delete(orders).where(eq(orders.id, orderId));
    await db.delete(orders).where(eq(orders.id, `${orderId}-uncertain`));
    await db.delete(seasons).where(eq(seasons.id, seasonId));
  });
  it("mengabaikan permintaan bersamaan dan mengembalikan pesanan yang sama pada pengulangan", async () => {
    let entered!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const hold = new Promise<void>((resolve) => { release = resolve; });
    mocks.create.mockImplementation(async (input) => {
      entered();
      await hold;
      await db.transaction(async (tx) => {
        await tx.insert(orders).values({ id: orderId, orderNumber: `IDEM-${suffix}`, publicToken: token, email: "player@example.test", mcUuid: "uuid", mcName: "Player", seasonId, subtotalIdr: 1000, totalIdr: 1000, expiresAt: new Date(Date.now() + 3600000) });
        await tx.update(checkoutAttempts).set({ orderId }).where(eq(checkoutAttempts.key, input.checkoutAttemptKey));
      });
      return { order: { publicToken: token }, paymentUrl: "https://example.test/pay" };
    });
    const key = checkoutAttemptKey(mocks.cartId, mocks.lines);
    const first = checkoutAction({}, form(key));
    await started;
    const concurrent = await checkoutAction({}, form(key));
    expect(concurrent.error).toMatch(/sedang diproses/);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    release();
    await expect(first).rejects.toThrow("REDIRECT:https://example.test/pay");
    expect((await findCheckoutAttempt(key, mocks.cartId))?.attempt.state).toBe("COMPLETE");
    mocks.lines = []; // Response lost after cart was cleared: repeat returns existing order.
    await expect(checkoutAction({}, form(key))).rejects.toThrow(`REDIRECT:/pesanan/${token}`);
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it("menolak formulir basi setelah isi keranjang berubah", async () => {
    mocks.lines = [{ id: "new-line", productId: "product", quantity: 1, targetUuid: null, targetName: null, isGift: false, addedAt: new Date() }];
    mocks.create.mockReset();
    const result = await checkoutAction({}, form("f".repeat(64)));
    expect(result.error).toMatch(/Keranjang berubah/);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("menahan order ketika respons gateway hilang dan tidak memanggil gateway lagi", async () => {
    mocks.lines = [{ id: "line2", productId: "product2", quantity: 1, targetUuid: null, targetName: null, isGift: false, addedAt: new Date() }];
    mocks.create.mockReset();
    mocks.create.mockImplementation(async (input) => {
      await db.transaction(async (tx) => {
        await tx.insert(orders).values({ id: `${orderId}-uncertain`, orderNumber: `IDEM-UNCERTAIN-${suffix}`, publicToken: `${token}-uncertain`, email: "player@example.test", mcUuid: "uuid", mcName: "Player", seasonId, subtotalIdr: 1000, totalIdr: 1000, expiresAt: new Date(Date.now() + 3600000) });
        await tx.update(checkoutAttempts).set({ orderId: `${orderId}-uncertain` }).where(eq(checkoutAttempts.key, input.checkoutAttemptKey));
      });
      throw new Error("response lost");
    });
    const key = checkoutAttemptKey(mocks.cartId, mocks.lines);
    const result = await checkoutAction({}, form(key));
    expect(result.error).toMatch(/belum dapat dipastikan/);
    expect(result.orderUrl).toBe(`/pesanan/${token}-uncertain`);
    expect((await findCheckoutAttempt(key, mocks.cartId))?.attempt.state).toBe("REVIEW");
    await expect(checkoutAction({}, form(key))).rejects.toThrow(`REDIRECT:/pesanan/${token}-uncertain`);
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
});
