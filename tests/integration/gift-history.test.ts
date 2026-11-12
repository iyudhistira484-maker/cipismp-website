import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { minecraftProfiles, orderItems, orders, products, seasons, users } from "@/server/db/schema";
import { giftsReceivedByUser, giftsSentByUser } from "@/server/gifts";
import { databaseUrl, uniqueSuffix } from "./helpers";

const suffix = uniqueSuffix(), buyer = `gift-buyer-${suffix}`, recipient = `gift-receiver-${suffix}`, stranger = `gift-stranger-${suffix}`, season = `gift-season-${suffix}`, product = `gift-product-${suffix}`, order = `gift-order-${suffix}`, uuid = `gift-uuid-${suffix}`;

describe.skipIf(!databaseUrl())("riwayat hadiah", () => {
  beforeAll(async () => {
    await db.insert(users).values([buyer, recipient, stranger].map((id, i) => ({ id, email: `${id}@example.test`, username: `gift${i}${suffix}`, passwordHash: "test" })));
    await db.insert(seasons).values({ id: season, slug: season, name: "Gift season", status: "UPCOMING", startAt: new Date(), endAt: new Date(Date.now() + 86400000) });
    await db.insert(products).values({ id: product, slug: product, name: "Gift rank", type: "RANK", tagline: "test", description: "test", priceIdr: 10000 });
    await db.insert(minecraftProfiles).values({ id: `profile-${suffix}`, uuid, edition: "JAVA", displayName: "Recipient", userId: recipient });
    await db.insert(orders).values({ id: order, orderNumber: order, publicToken: `secret-${suffix}`, userId: buyer, email: `${buyer}@example.test`, mcUuid: "buyer", mcName: "Buyer", seasonId: season, subtotalIdr: 10000, totalIdr: 10000, status: "PENDING", expiresAt: new Date() });
    await db.insert(orderItems).values({ id: `item-${suffix}`, orderId: order, productId: product, type: "RANK", nameSnapshot: "Gift rank", unitPriceIdr: 10000, lineTotalIdr: 10000, targetUuid: uuid, targetName: "Recipient", meta: { giftFromName: "Buyer" } });
  });
  afterAll(async () => {
    await db.delete(orders).where(eq(orders.id, order));
    await db.delete(minecraftProfiles).where(eq(minecraftProfiles.uuid, uuid));
    await db.delete(products).where(eq(products.id, product));
    await db.delete(seasons).where(eq(seasons.id, season));
    for (const id of [buyer, recipient, stranger]) await db.delete(users).where(eq(users.id, id));
  });
  it("hanya pembeli melihat hadiah dikirim dan tidak menampilkan hadiah belum dibayar sebagai diterima", async () => {
    expect((await giftsSentByUser(buyer)).items).toMatchObject([{ orderId: order, player: "Recipient" }]);
    expect((await giftsSentByUser(stranger)).items).toHaveLength(0);
    expect((await giftsReceivedByUser(recipient)).items).toHaveLength(0);
  });
  it("hadiah diterima memerlukan profil terverifikasi dan tidak mengekspos detail order pembeli", async () => {
    await db.update(orders).set({ status: "PAID", paidAt: new Date() }).where(eq(orders.id, order));
    expect((await giftsReceivedByUser(recipient)).items).toHaveLength(0);
    await db.update(minecraftProfiles).set({ verifiedAt: new Date() }).where(eq(minecraftProfiles.uuid, uuid));
    const rows = (await giftsReceivedByUser(recipient)).items;
    expect(rows).toMatchObject([{ name: "Gift rank", sender: "Buyer" }]);
    expect(rows[0]).not.toHaveProperty("orderId");
    expect(rows[0]).not.toHaveProperty("publicToken");
    expect((await giftsReceivedByUser(stranger)).items).toHaveLength(0);
  });
});
