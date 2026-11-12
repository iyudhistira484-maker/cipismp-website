import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { minecraftProfiles, orderItems, orders, products, seasons, supportTickets, users } from "@/server/db/schema";
import { customerTickets, staffTickets, supportOrderForUser } from "@/server/support";
import { giftsReceivedByUser, giftsSentByUser } from "@/server/gifts";
import { orderHistoryForUser } from "@/server/orders";
import { databaseUrl, uniqueSuffix } from "./helpers";

const suffix = uniqueSuffix(), owner = `history-owner-${suffix}`, recipient = `history-recipient-${suffix}`, other = `history-other-${suffix}`;
const season = `history-season-${suffix}`, product = `history-product-${suffix}`, uuid = `history-uuid-${suffix}`;
const ticketPrefix = `history-ticket-${suffix}-`, orderPrefix = `history-order-${suffix}-`, itemPrefix = `history-item-${suffix}-`;
const n = (i: number) => String(i).padStart(3, "0");

async function collect<T extends { id: string }>(load: (cursor?: string) => Promise<{ items: T[]; next: string | null; previous: string | null }>) {
  const first = await load();
  expect(first.items).toHaveLength(20);
  expect(first.previous).toBeNull();
  expect(first.next).toBeTruthy();
  const second = await load(first.next!);
  expect(second.items).toHaveLength(20);
  expect(second.previous).toBeTruthy();
  expect(second.next).toBeTruthy();
  const third = await load(second.next!);
  expect(third.items).toHaveLength(5);
  expect(third.next).toBeNull();
  const backSecond = await load(third.previous!);
  expect(backSecond.items.map((row) => row.id)).toEqual(second.items.map((row) => row.id));
  const backFirst = await load(backSecond.previous!);
  expect(backFirst.items.map((row) => row.id)).toEqual(first.items.map((row) => row.id));
  expect(backFirst.previous).toBeNull();
  const ids = [...first.items, ...second.items, ...third.items].map((row) => row.id);
  expect(new Set(ids).size).toBe(45);
  return { first, ids };
}

describe.skipIf(!databaseUrl())("paginasi riwayat", () => {
  beforeAll(async () => {
    await db.insert(users).values([owner, recipient, other].map((id, i) => ({ id, email: `${id}@example.test`, username: `hist${i}${suffix}`, passwordHash: "test" })));
    await db.insert(seasons).values({ id: season, name: "History test", slug: season, status: "UPCOMING", startAt: new Date(), endAt: new Date(Date.now() + 86400000) });
    await db.insert(products).values({ id: product, slug: product, name: "Gift kit", type: "KIT", tagline: "test", description: "test", priceIdr: 10000 });
    await db.insert(minecraftProfiles).values({ id: `history-profile-${suffix}`, uuid, edition: "JAVA", displayName: "Recipient", userId: recipient, verifiedAt: new Date() });
    // PostgreSQL microseconds differ but collapse to the same millisecond in JavaScript.
    await db.insert(supportTickets).values(Array.from({ length: 45 }, (_, i) => ({ id: ticketPrefix + n(i), userId: owner, subject: `Bantuan ${i}`, updatedAt: sql`${`2026-01-01T00:00:00.00000${i % 3 + 1}Z`}::timestamptz` })));
    await db.insert(orders).values(Array.from({ length: 45 }, (_, i) => ({ id: orderPrefix + n(i), orderNumber: orderPrefix + n(i), publicToken: `history-secret-${suffix}-${i}`, userId: owner, email: `${owner}@example.test`, mcUuid: "buyer", mcName: "Buyer", seasonId: season, subtotalIdr: 10000, totalIdr: 10000, status: "PAID" as const, expiresAt: new Date(), createdAt: sql`${`2026-01-01T00:00:00.00000${i % 3 + 1}Z`}::timestamptz`, paidAt: sql`${`2026-01-01T00:00:00.00000${i % 3 + 1}Z`}::timestamptz` })));
    await db.insert(orderItems).values(Array.from({ length: 45 }, (_, i) => ({ id: itemPrefix + n(i), orderId: orderPrefix + n(i), productId: product, type: "KIT" as const, nameSnapshot: "Gift kit", unitPriceIdr: 10000, lineTotalIdr: 10000, targetUuid: uuid, targetName: "Recipient", meta: { giftFromName: "Buyer" } })));
  });
  afterAll(async () => {
    await db.delete(supportTickets).where(eq(supportTickets.userId, owner));
    await db.delete(orders).where(eq(orders.userId, owner));
    await db.delete(minecraftProfiles).where(and(eq(minecraftProfiles.userId, recipient), eq(minecraftProfiles.uuid, uuid)));
    await db.delete(products).where(eq(products.id, product));
    await db.delete(seasons).where(eq(seasons.id, season));
    await db.delete(users).where(inArray(users.id, [owner, recipient, other]));
  });
  it("halaman bantuan milik pelanggan bergerak dua arah tanpa kehilangan data presisi mikrodetik", async () => {
    const { first } = await collect((cursor) => customerTickets(owner, cursor));
    expect((await customerTickets(other, first.next!)).items).toHaveLength(0);
    const staff = await staffTickets();
    expect(staff.items.some((row) => row.id.startsWith(ticketPrefix))).toBe(true);
  });
  it("riwayat pesanan dan pemilihan pesanan lama tetap dibatasi ke pemilik", async () => {
    const { first, ids } = await collect((cursor) => orderHistoryForUser(owner, cursor));
    expect((await orderHistoryForUser(other, first.next!)).items).toHaveLength(0);
    expect(await supportOrderForUser(owner, ids[44]!)).toMatchObject({ id: ids[44] });
    expect(await supportOrderForUser(other, ids[44]!)).toBeNull();
  });
  it("paginasi hadiah dikirim dan diterima tetap menjaga privasi", async () => {
    const sent = await collect((cursor) => giftsSentByUser(owner, cursor));
    const received = await collect((cursor) => giftsReceivedByUser(recipient, cursor));
    expect((await giftsSentByUser(other, sent.first.next!)).items).toHaveLength(0);
    expect((await giftsReceivedByUser(other, received.first.next!)).items).toHaveLength(0);
    expect(received.first.items[0]).not.toHaveProperty("orderId");
    expect(received.first.items[0]).not.toHaveProperty("publicToken");
  });
});
