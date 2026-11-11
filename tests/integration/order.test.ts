import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, like } from "drizzle-orm";
import { db } from "@/server/db";
import { entitlements, jobs, legalAcceptances, orderItems, orders, payments, products, seasons } from "@/server/db/schema";
import { createOrder, CheckoutError, fulfillPaidOrder } from "@/server/orders";
import { getSettings } from "@/server/settings";
import { databaseUrl, uniqueSuffix } from "./helpers";

const enabled = databaseUrl() !== null;
const suffix = uniqueSuffix();
const seasonId = `sn_order_${suffix}`;
const rank1 = `prd_order_${suffix}_1`;
const rank2 = `prd_order_${suffix}_2`;
const PLAYER = `CipiUji${suffix.slice(0, 4)}`;

const legal = { tos: "v1", privacy: "v1", sales: "v1" };

async function cleanup() {
  const stale = await db.query.orders.findMany({ where: like(orders.email, "order-test-%") });
  for (const order of stale) {
    await db.delete(orders).where(eq(orders.id, order.id));
  }
  await db.delete(entitlements).where(like(entitlements.productId, "prd_order_%"));
  await db.delete(products).where(like(products.slug, "order-uji-%"));
  await db.delete(seasons).where(like(seasons.slug, "season-order-%"));
}

const baseInput = {
  mcName: PLAYER,
  email: `order-test-${suffix}@example.com`,
  provider: "FAKE" as const,
  ip: "127.0.0.1",
  userAgent: "vitest",
  noRefundAccepted: true,
  legalVersions: legal,
};

describe.skipIf(!enabled)("pembuatan order (server-side totals)", () => {
  beforeAll(async () => {
    if (!enabled) return;
    await cleanup();
    await db.delete(seasons).where(like(seasons.slug, "season-order-%"));
    const now = new Date();
    await db.insert(seasons).values({
      id: seasonId,
      name: `Season Order ${suffix}`,
      slug: `season-order-${suffix}`,
      startAt: new Date(now.getTime() - 86_400_000),
      endAt: new Date(now.getTime() + 30 * 86_400_000),
      status: "ACTIVE",
      freezeDays: 3,
    });
    await db.insert(products).values([
      {
        id: rank1,
        slug: `order-uji-${suffix}-satu`,
        type: "RANK",
        name: "Rank Uji Satu",
        tagline: "Uji",
        description: "Produk uji order otomatis.",
        priceIdr: 25_000,
        tier: 1,
        status: "PUBLISHED",
        perks: [],
      },
      {
        id: rank2,
        slug: `order-uji-${suffix}-dua`,
        type: "RANK",
        name: "Rank Uji Dua",
        tagline: "Uji",
        description: "Produk uji order otomatis.",
        priceIdr: 60_000,
        tier: 2,
        status: "PUBLISHED",
        perks: [],
      },
    ]);
    const settings = await getSettings();
    if (!settings.store.checkoutEnabled) {
      throw new Error("Checkout harus aktif untuk test ini.");
    }
  });

  afterAll(async () => {
    if (!enabled) return;
    await cleanup();
  });

  it("menolak checkout tanpa persetujuan no-refund", async () => {
    await expect(
      createOrder({ ...baseInput, items: [{ productId: rank1 }], noRefundAccepted: false }),
    ).rejects.toBeInstanceOf(CheckoutError);
  });

  it("membuat order PENDING dengan total dari server dan payment row", async () => {
    const created = await createOrder({ ...baseInput, items: [{ productId: rank1 }] });
    expect(created.totalIdr).toBe(25_000);
    expect(created.order.status).toBe("PENDING");
    expect(created.statusUrl).toContain("/pesanan/");

    const items = await db.query.orderItems.findMany({ where: eq(orderItems.orderId, created.order.id) });
    expect(items).toHaveLength(1);
    expect(items[0]?.nameSnapshot).toBe("Rank Uji Satu");
    expect(items[0]?.lineTotalIdr).toBe(25_000);

    const payment = await db.query.payments.findFirst({ where: eq(payments.orderId, created.order.id) });
    expect(payment?.status).toBe("PENDING");
    expect(payment?.provider).toBe("FAKE");
    expect(payment?.amountIdr).toBe(25_000);

    const queued = await db.select().from(jobs).where(like(jobs.dedupeKey, `%${created.order.id}%`));
    expect(queued.some((job) => job.type === "order.expire")).toBe(true);
    expect(queued.some((job) => job.type === "email.send")).toBe(true);
  });

  it("memblokir pembelian ulang rank yang sudah dimiliki", async () => {
    const seedOrder = await createOrder({ ...baseInput, items: [{ productId: rank1 }] });
    const item = await db.query.orderItems.findFirst({ where: eq(orderItems.orderId, seedOrder.order.id) });
    expect(item).toBeDefined();

    // Season diambil dari order yang benar-benar dibuat, bukan dari fixture, agar
    // test tetap valid walau urutan antar-berkas test berubah.
    await db.insert(entitlements).values({
      id: `ent_order_${suffix}_1`,
      uuid: item!.targetUuid,
      productId: rank1,
      seasonId: seedOrder.order.seasonId,
      orderId: seedOrder.order.id,
      source: "PURCHASE",
      active: true,
      playerName: PLAYER,
    });

    await expect(createOrder({ ...baseInput, items: [{ productId: rank1 }] })).rejects.toThrow(
      /sudah kamu miliki|tidak bisa membeli rank ini/i,
    );
  });

  it("upgrade hanya menagih selisih harga", async () => {
    const created = await createOrder({ ...baseInput, items: [{ productId: rank2 }] });
    expect(created.totalIdr).toBe(35_000);
    const order = await db.query.orders.findFirst({ where: eq(orders.id, created.order.id) });
    expect(order?.subtotalIdr).toBe(35_000);
  });

  it("hadiah: pembayaran mengirim entitlement ke UUID penerima, bukan pembeli", async () => {
    const recipientName = `Teman${suffix.slice(0, 4)}`;
    const created = await createOrder({
      ...baseInput,
      items: [{ productId: rank2, targetName: recipientName }],
    });

    const item = await db.query.orderItems.findFirst({ where: eq(orderItems.orderId, created.order.id) });
    expect(item?.targetName).toBe(recipientName);
    expect(item?.meta?.giftFromName).toBe(PLAYER);

    const order = await db.query.orders.findFirst({ where: eq(orders.id, created.order.id) });
    expect(order?.mcName).toBe(PLAYER);
    expect(item?.targetUuid).not.toBe(order?.mcUuid);

    await fulfillPaidOrder({
      orderId: created.order.id,
      paymentId: null,
      amountIdr: created.totalIdr,
      method: "TEST",
    });

    const granted = await db.query.entitlements.findFirst({
      where: and(eq(entitlements.uuid, item!.targetUuid), eq(entitlements.productId, rank2)),
    });
    expect(granted).toBeDefined();
    expect(granted?.playerName).toBe(recipientName);

    const buyerEntitlement = await db.query.entitlements.findFirst({
      where: and(eq(entitlements.uuid, order!.mcUuid), eq(entitlements.productId, rank2)),
    });
    expect(buyerEntitlement).toBeUndefined();
  });

  it("menolak hadiah untuk akun Minecraft sendiri", async () => {
    await expect(
      createOrder({ ...baseInput, items: [{ productId: rank1, targetName: PLAYER }] }),
    ).rejects.toThrow(/tidak boleh sama/i);
  });

  it("menyimpan persetujuan dokumen legal (syarat, privasi, penjualan)", async () => {
    const rows = await db.select().from(legalAcceptances).where(eq(legalAcceptances.email, baseInput.email));
    const docTypes = new Set(rows.map((row) => row.docType));
    expect(docTypes.has("SALES")).toBe(true);
    expect(docTypes.has("TOS")).toBe(true);
    expect(rows.every((row) => row.version === "v1")).toBe(true);
  });
});
