import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { cursorCondition, cursorOrder, cursorPage, cursorTimestamp, decodeCursor, PAGE_SIZE } from "./pagination";
import { db } from "./db";
import { minecraftProfiles, orderItems, orders, seasons } from "./db/schema";

/** Sent gifts expose order links only to their purchaser. */
export async function giftsSentByUser(userId: string, rawCursor?: string) {
  const cursor = decodeCursor(rawCursor);
  const rows = await db.select({ id: orderItems.id, cursorAt: cursorTimestamp(orders.createdAt), name: orderItems.nameSnapshot, player: orderItems.targetName, orderId: orders.id, orderNumber: orders.orderNumber, status: orders.status, createdAt: orders.createdAt, seasonName: seasons.name })
    .from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId)).innerJoin(seasons, eq(seasons.id, orders.seasonId))
    .where(and(eq(orders.userId, userId), sql`${orderItems.meta}->>'giftFromName' is not null`, cursorCondition(orders.createdAt, orderItems.id, cursor)))
    .orderBy(...cursorOrder(orders.createdAt, orderItems.id, cursor)).limit(PAGE_SIZE + 1);
  return cursorPage(rows, cursor);
}

/** Recipients can see only gifts for their verified UUID, not the buyer's order or invoice. */
export async function giftsReceivedByUser(userId: string, rawCursor?: string) {
  const cursor = decodeCursor(rawCursor);
  const receivedAt = sql`coalesce(${orders.paidAt}, ${orders.createdAt})`;
  const rows = await db.select({ id: orderItems.id, cursorAt: cursorTimestamp(receivedAt), name: orderItems.nameSnapshot, player: orderItems.targetName, sender: sql<string>`${orderItems.meta}->>'giftFromName'`, status: orders.status, paidAt: orders.paidAt, seasonName: seasons.name })
    .from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId)).innerJoin(seasons, eq(seasons.id, orders.seasonId))
    .innerJoin(minecraftProfiles, eq(minecraftProfiles.uuid, orderItems.targetUuid))
    .where(and(eq(minecraftProfiles.userId, userId), isNotNull(minecraftProfiles.verifiedAt), sql`${orderItems.meta}->>'giftFromName' is not null`, inArray(orders.status, ["PAID", "DELIVERING", "DELIVERED", "FAILED"]), cursorCondition(receivedAt, orderItems.id, cursor)))
    .orderBy(...cursorOrder(receivedAt, orderItems.id, cursor)).limit(PAGE_SIZE + 1);
  return cursorPage(rows, cursor);
}
