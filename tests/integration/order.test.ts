import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray, like } from "drizzle-orm";
import { db } from "@/server/db";
import { automaticDiscounts, commandTemplates, couponRedemptions, coupons, entitlements, jobs, legalAcceptances, minecraftProfiles, notifications, orderItems, orders, payments, products, seasons, servers, staffMinecraftAccounts, users } from "@/server/db/schema";
import { deterministicUuid } from "@/server/minecraft";
import { createOrder, CheckoutError, fulfillPaidOrder } from "@/server/orders";
import { getSettings } from "@/server/settings";
import { updateCouponPreservingOrderReferences } from "@/server/coupon-admin";
import { knownStaffDeliveryQuery } from "@/server/staff-rank";
import { databaseUrl, uniqueSuffix } from "./helpers";

const enabled = databaseUrl() !== null;
const suffix = uniqueSuffix();
const seasonId = `sn_order_${suffix}`;
const rank1 = `prd_order_${suffix}_1`;
const rank2 = `prd_order_${suffix}_2`;
const serverId = `order-server-${suffix}`;
let previousServers: string[] = [];
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
    previousServers = (await db.select({ id: servers.id }).from(servers).where(eq(servers.isDefault, true))).map((server) => server.id);
    await db.update(servers).set({ isDefault: false }).where(eq(servers.isDefault, true));
    await db.insert(servers).values({ id: serverId, name: "Order test", javaHost: "example.test", bedrockHost: "example.test", isDefault: true, deliveryMode: "PLUGIN" });
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
    await db.insert(commandTemplates).values([
      { id: `grant-${rank1}`, productId: rank1, kind: "GRANT", template: "lp user {uuid} parent add vip" },
      { id: `revoke-${rank1}`, productId: rank1, kind: "REVOKE", template: "lp user {uuid} parent remove vip" },
      { id: `grant-${rank2}`, productId: rank2, kind: "GRANT", template: "lp user {uuid} parent add mvp" },
      { id: `revoke-${rank2}`, productId: rank2, kind: "REVOKE", template: "lp user {uuid} parent remove mvp" },
    ]);
    const settings = await getSettings();
    if (!settings.store.checkoutEnabled) {
      throw new Error("Checkout harus aktif untuk test ini.");
    }
  });

  afterAll(async () => {
    if (!enabled) return;
    await cleanup();
    await db.delete(servers).where(eq(servers.id, serverId));
    if (previousServers.length) await db.update(servers).set({ isDefault: true }).where(inArray(servers.id, previousServers));
  });

  it("checkout tidak mengambil alih profil Minecraft yang diverifikasi akun lain", async () => {
    const ownerId = `profile-owner-${suffix}`;
    const buyerId = `profile-buyer-${suffix}`;
    const uuid = deterministicUuid(PLAYER, "JAVA");
    await db.insert(users).values([
      { id: ownerId, email: `${ownerId}@example.test`, username: `own${suffix}`, passwordHash: "test" },
      { id: buyerId, email: `${buyerId}@example.test`, username: `buy${suffix}`, passwordHash: "test" },
    ]);
    await db.insert(minecraftProfiles).values({ id: `profile-${suffix}`, uuid, edition: "JAVA", displayName: PLAYER, userId: ownerId, verifiedAt: new Date() });
    try {
      await createOrder({ ...baseInput, userId: buyerId, email: `order-test-profile-${suffix}@example.com`, items: [{ productId: rank1 }] });
      expect(await db.query.minecraftProfiles.findFirst({ where: eq(minecraftProfiles.uuid, uuid) })).toMatchObject({ userId: ownerId, displayName: PLAYER });
    } finally {
      await db.delete(minecraftProfiles).where(eq(minecraftProfiles.uuid, uuid));
      await db.delete(users).where(eq(users.id, buyerId));
      await db.delete(users).where(eq(users.id, ownerId));
    }
  });

  it("menolak rank bagi pembeli staf dan penerima hadiah yang diverifikasi ke staf", async () => {
    const staffId = `staff-rank-${suffix}`;
    const uuid = deterministicUuid(PLAYER, "JAVA");
    await db.insert(users).values({ id: staffId, email: `${staffId}@example.test`, username: `stf${suffix}`, passwordHash: "test", role: "SUPPORT" });
    await db.insert(minecraftProfiles).values({ id: `staff-profile-${suffix}`, uuid, edition: "JAVA", displayName: PLAYER, userId: staffId, verifiedAt: new Date() });
    try {
      await expect(createOrder({ ...baseInput, userId: staffId, items: [{ productId: rank1, targetName: `Gift${suffix.slice(0, 4)}` }] })).rejects.toThrow(/Rank tidak tersedia untuk staf/);
      await expect(createOrder({ ...baseInput, mcName: `Buyer${suffix.slice(0, 4)}`, items: [{ productId: rank1, targetName: PLAYER }] })).rejects.toThrow(/Rank tidak tersedia untuk staf/);
      await db.update(users).set({ role: "CUSTOMER" }).where(eq(users.id, staffId));
      const allowed = await createOrder({ ...baseInput, userId: staffId, items: [{ productId: rank1 }] });
      expect(allowed.order.id).toBeTruthy();
    } finally {
      await db.delete(minecraftProfiles).where(eq(minecraftProfiles.uuid, uuid));
      await db.delete(users).where(eq(users.id, staffId));
    }
  });

  it("menolak akun alternatif staf yang didaftarkan owner sebagai pembeli atau penerima hadiah", async () => {
    const staffId = `staff-alternate-${suffix}`;
    const alternate = `Alt${suffix.slice(0, 5)}`;
    const altUuid = deterministicUuid(alternate, "JAVA");
    const pending = await createOrder({ ...baseInput, mcName: alternate, items: [{ productId: rank1, targetName: `Gift${suffix.slice(0, 4)}` }] });
    const recipientUuid = deterministicUuid(`Gift${suffix.slice(0, 4)}`, "JAVA");
    await db.insert(users).values({ id: staffId, email: `${staffId}@example.test`, username: `saf${suffix}`, passwordHash: "test", role: "SUPPORT" });
    await db.insert(staffMinecraftAccounts).values({ uuid: altUuid, staffUserId: staffId, label: "akun alternatif" });
    try {
      expect((await db.execute(knownStaffDeliveryQuery(recipientUuid, pending.order.id))).rows[0]?.restricted).toBe(true);
      await expect(createOrder({ ...baseInput, mcName: alternate, items: [{ productId: rank1, targetName: `Gift${suffix.slice(0, 4)}` }] })).rejects.toThrow(/Rank tidak tersedia untuk staf/);
      await expect(createOrder({ ...baseInput, items: [{ productId: rank1, targetName: alternate }] })).rejects.toThrow(/Rank tidak tersedia untuk staf/);
      await db.update(users).set({ role: "CUSTOMER" }).where(eq(users.id, staffId));
      const allowed = await createOrder({ ...baseInput, mcName: alternate, items: [{ productId: rank1 }] });
      expect(allowed.order.id).toBeTruthy();
    } finally {
      await db.delete(staffMinecraftAccounts).where(eq(staffMinecraftAccounts.uuid, altUuid));
      await db.delete(users).where(eq(users.id, staffId));
    }
  });

  it("tidak membuat pembayaran rank jika server hanya memakai RCON", async () => {
    const email = `order-test-rcon-${suffix}@example.com`;
    await db.update(servers).set({ deliveryMode: "RCON" }).where(eq(servers.id, serverId));
    try {
      await expect(createOrder({ ...baseInput, email, items: [{ productId: rank1 }] })).rejects.toThrow(/pemeriksaan grup staf/);
      expect(await db.query.orders.findFirst({ where: eq(orders.email, email) })).toBeUndefined();
    } finally {
      await db.update(servers).set({ deliveryMode: "PLUGIN" }).where(eq(servers.id, serverId));
    }
  });

  it("menolak template berbahaya sebelum membuat order atau pembayaran", async () => {
    const templateId = `grant-${rank1}`;
    await db.update(commandTemplates).set({ template: "lp user {player} parent set vip" }).where(eq(commandTemplates.id, templateId));
    const email = `order-test-unsafe-${suffix}@example.com`;
    try {
      await expect(createOrder({ ...baseInput, email, items: [{ productId: rank1 }] })).rejects.toThrow(/belum siap dikirim dengan aman/);
      expect(await db.query.orders.findFirst({ where: eq(orders.email, email) })).toBeUndefined();
      await db.update(commandTemplates).set({ template: "# belum ada perintah" }).where(eq(commandTemplates.id, templateId));
      await expect(createOrder({ ...baseInput, email, items: [{ productId: rank1 }] })).rejects.toThrow(/belum siap dikirim dengan aman/);
    } finally {
      await db.update(commandTemplates).set({ template: "lp user {uuid} parent add vip" }).where(eq(commandTemplates.id, templateId));
    }
  });

  it("menolak transaksi Bedrock yang belum diverifikasi daripada mengirim ke UUID sementara", async () => {
    await expect(createOrder({ ...baseInput, mcName: `.Bed${suffix.slice(0, 5)}`, items: [{ productId: rank1 }] }))
      .rejects.toThrow(/harus diverifikasi in-game/);
  });

  it("menyimpan satu reservasi kupon pada checkout paralel dengan kuota satu", async () => {
    const couponId = `coupon-parallel-${suffix}`;
    const code = `PARALLEL-${suffix.toUpperCase()}`;
    await db.insert(coupons).values({ id: couponId, code, type: "FIXED", value: 1000, maxRedemptions: 1, maxPerUser: 1, active: true });
    try {
      const results = await Promise.allSettled([
        createOrder({ ...baseInput, mcName: `Alice${suffix.slice(0, 4)}`, email: `order-test-a-${suffix}@example.com`, couponCode: code, items: [{ productId: rank1 }] }),
        createOrder({ ...baseInput, mcName: `Bobby${suffix.slice(0, 4)}`, email: `order-test-b-${suffix}@example.com`, couponCode: code, items: [{ productId: rank1 }] }),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    } finally {
      await db.delete(coupons).where(eq(coupons.id, couponId));
    }
  });

  it("memenuhi pembayaran terlambat dan memberi peringatan jika kuota sudah dipesan lagi", async () => {
    const couponId = `coupon-late-${suffix}`, code = `LATE-${suffix.toUpperCase()}`;
    await db.insert(coupons).values({ id: couponId, code, type: "FIXED", value: 1000, maxRedemptions: 1, maxPerUser: 1, active: true });
    try {
      const first = await createOrder({ ...baseInput, mcName: `LateA${suffix.slice(0, 4)}`, email: `order-test-late-a-${suffix}@example.com`, couponCode: code, items: [{ productId: rank1 }] });
      await db.update(orders).set({ status: "EXPIRED", expiresAt: new Date(Date.now() - 1000) }).where(eq(orders.id, first.order.id));
      await createOrder({ ...baseInput, mcName: `LateB${suffix.slice(0, 4)}`, email: `order-test-late-b-${suffix}@example.com`, couponCode: code, items: [{ productId: rank1 }] });
      const existing = await db.query.coupons.findFirst({ where: eq(coupons.id, couponId) });
      await expect(updateCouponPreservingOrderReferences(couponId, { ...existing!, code: `NEW-${suffix.toUpperCase()}` })).rejects.toThrow(/tidak dapat diubah/i);
      const result = await fulfillPaidOrder({ orderId: first.order.id, paymentId: null, amountIdr: first.totalIdr });
      expect(result.alreadyPaid).toBe(false);
      expect((await db.query.orders.findFirst({ where: eq(orders.id, first.order.id) }))?.paidAt).not.toBeNull();
      const notices = await db.select().from(notifications).where(eq(notifications.href, `/admin/pesanan/${first.order.id}`));
      expect(notices.some((notice) => notice.kind === "PAYMENT_ANOMALY" && notice.title.includes("kupon"))).toBe(true);
      const queued = await db.select().from(jobs).where(like(jobs.dedupeKey, `%${first.order.id}%`));
      expect(queued.some((job) => job.dedupeKey === `email-paid:${first.order.id}`)).toBe(true);
      await db.delete(notifications).where(eq(notifications.href, `/admin/pesanan/${first.order.id}`));
    } finally { await db.delete(coupons).where(eq(coupons.id, couponId)); }
  });

  it("menolak checkout tanpa persetujuan no-refund", async () => {
    await expect(
      createOrder({ ...baseInput, items: [{ productId: rank1 }], noRefundAccepted: false }),
    ).rejects.toBeInstanceOf(CheckoutError);
  });

  it("menolak metode pembayaran yang tidak ditawarkan provider", async () => {
    await expect(
      createOrder({ ...baseInput, items: [{ productId: rank1 }], method: "NOT_A_PAYMENT_METHOD" }),
    ).rejects.toThrow(/metode pembayaran yang dipilih tidak aktif/i);
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

  it("mencatat promo otomatis pada order dan tidak membuat penukaran kupon", async () => {
    const id = `auto_order_${suffix}`;
    await db.insert(automaticDiscounts).values({ id, name: "Promo order", type: "FIXED", value: 5_000, seasonId });
    try {
      const created = await createOrder({ ...baseInput, items: [{ productId: rank1 }] });
      expect(created.order).toMatchObject({ subtotalIdr: 25_000, discountIdr: 5_000, totalIdr: 20_000, discountLabel: "Promo order", couponCode: null });
      await fulfillPaidOrder({ orderId: created.order.id, paymentId: null, amountIdr: created.totalIdr, method: "TEST" });
      expect(await db.select().from(couponRedemptions).where(eq(couponRedemptions.orderId, created.order.id))).toHaveLength(0);
      // The fulfillment grants rank; remove it so subsequent tests keep their fixtures.
      await db.delete(entitlements).where(eq(entitlements.orderId, created.order.id));
    } finally {
      await db.delete(automaticDiscounts).where(eq(automaticDiscounts.id, id));
    }
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
