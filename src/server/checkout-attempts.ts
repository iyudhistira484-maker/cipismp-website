import { createHash } from "node:crypto";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "./db";
import { checkoutAttempts, orders } from "./db/schema";
import type { CartLine } from "./cart";

/** Same cart contents yield the same key across tabs and reloads. It is an identifier, not authorization; all lookups also require the current cart. */
export function checkoutAttemptKey(cartId: string, lines: CartLine[]): string {
  const snapshot = lines.map((line) => [line.id, line.productId, line.quantity, line.targetUuid, line.targetName, line.isGift])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return createHash("sha256").update(JSON.stringify(["checkout-v1", cartId, snapshot])).digest("hex");
}

export async function findCheckoutAttempt(key: string, cartId: string) {
  if (!/^[a-f0-9]{64}$/.test(key)) return null;
  const attempt = await db.query.checkoutAttempts.findFirst({ where: and(eq(checkoutAttempts.key, key), eq(checkoutAttempts.cartId, cartId)) });
  if (!attempt) return null;
  const order = attempt.orderId ? await db.query.orders.findFirst({ where: eq(orders.id, attempt.orderId) }) : null;
  return { attempt, order };
}

/** Unique insert is the concurrency barrier, shared by all app instances. */
export async function claimCheckoutAttempt(key: string, cartId: string): Promise<boolean> {
  const inserted = await db.insert(checkoutAttempts).values({ key, cartId, state: "PROCESSING" })
    .onConflictDoNothing({ target: checkoutAttempts.key }).returning({ key: checkoutAttempts.key });
  return inserted.length === 1;
}

export async function completeCheckoutAttempt(key: string): Promise<void> {
  await db.update(checkoutAttempts).set({ state: "COMPLETE", updatedAt: new Date() }).where(eq(checkoutAttempts.key, key));
}

/** Only a claim with no committed order can ever be released for a retry. */
export async function failCheckoutAttempt(key: string): Promise<void> {
  const retained = await db.update(checkoutAttempts).set({ state: "REVIEW", updatedAt: new Date() })
    .where(and(eq(checkoutAttempts.key, key), isNotNull(checkoutAttempts.orderId))).returning({ key: checkoutAttempts.key });
  if (retained.length === 0) {
    await db.delete(checkoutAttempts).where(and(eq(checkoutAttempts.key, key), isNull(checkoutAttempts.orderId)));
  }
}

/** Recovery after the cart was cleared but the redirect was lost. */
export async function latestCheckoutOrder(cartId: string) {
  const [row] = await db.select({ token: orders.publicToken })
    .from(checkoutAttempts).innerJoin(orders, eq(checkoutAttempts.orderId, orders.id))
    .where(eq(checkoutAttempts.cartId, cartId)).orderBy(desc(checkoutAttempts.createdAt)).limit(1);
  return row ?? null;
}
