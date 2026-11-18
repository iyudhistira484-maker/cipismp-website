import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { checkoutAttempts } from "@/server/db/schema";
import { checkoutAttemptKey, claimCheckoutAttempt, completeCheckoutAttempt, failCheckoutAttempt, findCheckoutAttempt } from "@/server/checkout-attempts";
import { databaseUrl, uniqueSuffix } from "./helpers";
import type { CartLine } from "@/server/cart";

const enabled = databaseUrl() !== null;
const cart = `cart-checkout-attempt-${uniqueSuffix()}`;
const line: CartLine = { id: "item-a", productId: "product", quantity: 1, targetUuid: null, targetName: null, isGift: false, addedAt: new Date() };

describe.skipIf(!enabled)("klaim checkout di PostgreSQL", () => {
  afterAll(async () => { await db.delete(checkoutAttempts).where(eq(checkoutAttempts.cartId, cart)); });
  it("menentukan snapshot secara stabil dan membedakan perubahan keranjang atau identitas", () => {
    const other = { ...line, id: "item-b" };
    expect(checkoutAttemptKey(cart, [line, other])).toBe(checkoutAttemptKey(cart, [other, line]));
    expect(checkoutAttemptKey(cart, [line])).not.toBe(checkoutAttemptKey(cart, [{ ...line, quantity: 2 }]));
    expect(checkoutAttemptKey(cart, [line])).not.toBe(checkoutAttemptKey(`${cart}-different`, [line]));
  });
  it("hanya satu permintaan serentak yang dapat memiliki snapshot yang sama", async () => {
    const key = checkoutAttemptKey(cart, [line]);
    const results = await Promise.all(Array.from({ length: 20 }, () => claimCheckoutAttempt(key, cart)));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await findCheckoutAttempt(key, `${cart}-different`)).toBeNull();
    expect((await findCheckoutAttempt(key, cart))?.attempt.state).toBe("PROCESSING");
    await failCheckoutAttempt(key);
    expect(await claimCheckoutAttempt(key, cart)).toBe(true);
    await db.update(checkoutAttempts).set({ orderId: "committed-order" }).where(eq(checkoutAttempts.key, key));
    await failCheckoutAttempt(key);
    expect((await findCheckoutAttempt(key, cart))?.attempt.state).toBe("REVIEW");
    expect(await claimCheckoutAttempt(key, cart)).toBe(false);
    await completeCheckoutAttempt(key);
    expect((await findCheckoutAttempt(key, cart))?.attempt.state).toBe("COMPLETE");
    expect(await claimCheckoutAttempt(key, cart)).toBe(false);
  });
});
