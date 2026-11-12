import { and, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { db } from "./db";
import {
  couponRedemptions,
  coupons,
  deliveries,
  entitlements,
  legalAcceptances,
  jobs,
  notifications,
  orderItems,
  orders,
  payments,
  products,
  seasons,
  servers,
  users,
  type Order,
  type OrderItem,
} from "./db/schema";
import { ids } from "./ids";
import { cursorCondition, cursorOrder, cursorPage, cursorTimestamp, decodeCursor, PAGE_SIZE } from "./pagination";
import { logger } from "./logger";
import { enqueue } from "./queue";
import { getActiveSeason } from "./catalog";
import { ownedMap } from "./entitlements";
import { getSettings } from "./settings";
import { loadAutomaticDiscounts } from "./discounts";
import { buildGrantCommands, buildRevokeCommands } from "./delivery/commands";
import { deliveryCommandsAreSafe } from "./delivery/command-safety";
import { resolvePlayer, upsertProfile } from "./minecraft";
import { hasKnownStaffRankRestriction } from "./staff-rank";
import { priceCart, type CouponInput, type PriceableProduct } from "@/lib/pricing";
import { canPurchase } from "@/lib/seasons";
import { addMinutes } from "@/lib/dates";
import { generateOrderNumber, randomId } from "@/lib/utils";
import { getAdapter, getAvailableProviders, ProviderUnavailableError, type ProviderId } from "./payments";

export class CheckoutError extends Error {
  constructor(
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

export interface CreateOrderInput {
  /** `targetName` diisi untuk item hadiah; aturan rank dievaluasi terhadap penerima. */
  items: Array<{ productId: string; quantity?: number; targetName?: string | null }>;
  mcName: string;
  email: string;
  couponCode?: string | null;
  userId?: string | null;
  provider: ProviderId;
  method?: string | null;
  ip: string;
  userAgent: string;
  noRefundAccepted: boolean;
  legalVersions: { tos: string; privacy: string; sales: string };
}

export interface CreatedOrder {
  order: Order;
  orderNumber: string;
  totalIdr: number;
  statusUrl: string;
  paymentUrl: string | null;
  payCode: string | null;
  expiresAt: Date;
}

export async function createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
  if (!input.noRefundAccepted) {
    throw new CheckoutError(
      "Kamu harus menyetujui pernyataan bahwa semua pembelian bersifat final dan tidak dapat direfund.",
      { noRefund: "Wajib disetujui sebelum melanjutkan." },
    );
  }

  const season = await getActiveSeason();
  if (!season) throw new CheckoutError("Belum ada season aktif. Pembelian akan dibuka saat season dimulai.");

  const purchaseCheck = canPurchase(season);
  if (!purchaseCheck.ok) {
    throw new CheckoutError(
      purchaseCheck.reason === "FROZEN"
        ? `Pembelian ditutup pada ${season.freezeDays} hari terakhir season.`
        : "Season ini belum bisa dibeli.",
    );
  }

  const settings = await getSettings();
  if (!settings.store.checkoutEnabled) throw new CheckoutError("Checkout sedang dinonaktifkan sementara.");
  if (input.couponCode?.trim() && !settings.features.coupons) {
    throw new CheckoutError("Kupon sedang dinonaktifkan oleh admin.");
  }

  const availableProvider = (await getAvailableProviders()).find((provider) => provider.id === input.provider);
  if (!availableProvider) throw new CheckoutError("Gateway pembayaran yang dipilih tidak aktif atau belum siap.");
  const method = input.method?.trim() || availableProvider.methods[0]?.code;
  if (!method || !availableProvider.methods.some((option) => option.code === method)) {
    throw new CheckoutError("Metode pembayaran yang dipilih tidak aktif. Muat ulang checkout lalu pilih metode lain.");
  }

  const player = await resolvePlayer(input.mcName);
  if (player.edition === "BEDROCK" && player.source !== "cache") {
    throw new CheckoutError("Akun Bedrock harus diverifikasi in-game sebelum pembelian agar pengiriman sampai ke UUID yang benar.", { mcName: "Hubungkan akun Bedrock melalui dashboard terlebih dahulu." });
  }

  // Resolusi penerima per item: hadiah diverifikasi ke UUID masing-masing agar aturan
  // "rank sudah dimiliki" dan "upgrade hanya selisih" dihitung untuk penerimanya.
  const resolvedItems: Array<{ productId: string; quantity: number; uuid: string; name: string; edition: "JAVA" | "BEDROCK"; gift: boolean }> = [];
  for (const item of input.items) {
    const giftName = item.targetName?.trim();
    if (giftName) {
      const recipient = await resolvePlayer(giftName);
      if (recipient.edition === "BEDROCK" && recipient.source !== "cache") {
        throw new CheckoutError("Penerima Bedrock harus memverifikasi akun in-game sebelum menerima hadiah.");
      }
      if (recipient.uuid === player.uuid) {
        throw new CheckoutError("Penerima hadiah tidak boleh sama dengan akun Minecraft kamu sendiri.", {
          cart: "Hapus hadiah untuk diri sendiri, atau ganti username penerima.",
        });
      }
      resolvedItems.push({
        productId: item.productId,
        quantity: item.quantity ?? 1,
        uuid: recipient.uuid,
        name: recipient.name,
        edition: recipient.edition,
        gift: true,
      });
    } else {
      resolvedItems.push({
        productId: item.productId,
        quantity: item.quantity ?? 1,
        uuid: player.uuid,
        name: player.name,
        edition: player.edition,
        gift: false,
      });
    }
  }

  const productIds = [...new Set(resolvedItems.map((item) => item.productId))];
  const productRows = await db.select().from(products).where(inArray(products.id, productIds));
  if (productRows.length !== productIds.length) throw new CheckoutError("Sebagian produk tidak ditemukan.");

  const rankIds = new Set(productRows.filter((product) => product.type === "RANK").map((product) => product.id));
  if (rankIds.size && await hasKnownStaffRankRestriction(input.userId, [player.uuid, ...resolvedItems.filter((item) => rankIds.has(item.productId)).map((item) => item.uuid)])) {
    throw new CheckoutError("Rank tidak tersedia untuk staf atau penerima yang terhubung dengan akun staf.");
  }

  const catalog = new Map<string, PriceableProduct>(
    productRows.map((p) => [
      p.id,
      {
        id: p.id,
        slug: p.slug,
        name: p.name,
        type: p.type,
        priceIdr: p.priceIdr,
        tier: p.tier,
        maxPerSeason: p.maxPerSeason,
        cooldownHours: p.cooldownHours,
        status: p.status,
        deletedAt: p.deletedAt,
      },
    ]),
  );

  const owned = await ownedMap([...new Set(resolvedItems.map((item) => item.uuid))], season.id);
  const [coupon, automaticDiscounts] = await Promise.all([
    input.couponCode ? loadCouponInput(input.couponCode, input.email) : Promise.resolve(null),
    loadAutomaticDiscounts(),
  ]);

  if (input.couponCode?.trim() && !coupon) {
    throw new CheckoutError("Kode kupon tidak ditemukan atau sudah tidak berlaku.");
  }

  const pricing = priceCart({
    items: resolvedItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      targetUuid: item.uuid,
      targetName: item.name,
    })),
    catalog,
    ownedByTarget: owned,
    coupon,
    automaticDiscounts,
    seasonId: season.id,
    settings: {
      taxPercent: settings.store.taxPercent,
      feeMode: settings.store.feeMode,
      feeFlatIdr: settings.store.feeFlatIdr,
      feePercent: settings.store.feePercent,
      seasonFrozen: false,
    },
  });

  if (!pricing.ok || pricing.lines.length === 0) {
    throw new CheckoutError(pricing.errors[0]?.message ?? "Keranjang tidak valid.", {
      cart: pricing.errors.map((e) => e.message).join(" "),
    });
  }

  // RCON cannot inspect live staff groups; avoid charging for rank until a
  // plugin-backed server is configured. The plugin itself must also be updated
  // and verified on the server before sales are enabled.
  if (pricing.lines.some((line) => line.type === "RANK" && productRows.find((product) => product.id === line.productId)?.useServerCommands)) {
    const server = await db.query.servers.findFirst({ where: eq(servers.isDefault, true) });
    if (!server || server.deliveryMode !== "PLUGIN") {
      throw new CheckoutError("Pengiriman rank belum siap dengan pemeriksaan grup staf. Hubungi admin sebelum membayar.");
    }
  }
  // Fail before taking payment if a configured command cannot pass the delivery
  // allowlist. Templates can still change later, so dispatch rechecks as well.
  for (const line of pricing.lines) {
    const product = productRows.find((row) => row.id === line.productId);
    if (!product?.useServerCommands) continue;
    const context = { player: line.targetName, uuid: line.targetUuid, seasonSlug: season.slug };
    const grant = await buildGrantCommands({ ...context, productId: line.productId });
    const revoke = line.upgradeFrom ? await buildRevokeCommands({ ...context, productId: line.upgradeFrom.productId }) : [];
    if (!grant.length || !deliveryCommandsAreSafe(grant, line.targetName, line.targetUuid) ||
        (line.upgradeFrom && (!revoke.length || !deliveryCommandsAreSafe(revoke, line.targetName, line.targetUuid)))) {
      throw new CheckoutError("Produk belum siap dikirim dengan aman. Hubungi admin sebelum membayar.");
    }
  }

  // Payment gateways require a positive amount. Do not create a stranded pending
  // order when a promotion makes the payable amount zero.
  if (pricing.totalIdr <= 0) {
    throw new CheckoutError("Total pembayaran harus lebih dari Rp 0. Hubungi admin untuk menyesuaikan promo.");
  }

  const orderId = ids.order();
  const orderNumber = generateOrderNumber();
  const publicToken = randomId(32);
  const expiresAt = addMinutes(new Date(), settings.store.orderExpiryMinutes);

  const created = await db.transaction(async (tx) => {
    // Reserve a coupon slot while the pending order is payable. Serialize all
    // reservations and paid redemptions on its row to avoid concurrent oversubscription.
    if (pricing.couponCode) {
      const [lockedCoupon] = await tx.select().from(coupons).where(eq(coupons.code, pricing.couponCode)).limit(1).for("update");
      if (!lockedCoupon || !coupon || !lockedCoupon.active ||
          (lockedCoupon.startsAt && lockedCoupon.startsAt.getTime() > Date.now()) ||
          (lockedCoupon.endsAt && lockedCoupon.endsAt.getTime() < Date.now()) ||
          lockedCoupon.value !== coupon.value || lockedCoupon.type !== coupon.type ||
          lockedCoupon.minSubtotalIdr !== coupon.minSubtotalIdr || lockedCoupon.seasonId !== coupon.seasonId ||
          lockedCoupon.rankOnly !== coupon.rankOnly || lockedCoupon.kitOnly !== coupon.kitOnly ||
          lockedCoupon.eligibleItemsOnly !== coupon.eligibleItemsOnly ||
          JSON.stringify(lockedCoupon.tiers) !== JSON.stringify(coupon.tiers) ||
          lockedCoupon.startsAt?.getTime() !== coupon.startsAt?.getTime() ||
          lockedCoupon.endsAt?.getTime() !== coupon.endsAt?.getTime()) {
        throw new CheckoutError("Kupon berubah. Muat ulang checkout dan coba lagi.");
      }
      const redemptionCounts = await tx.select({ total: sql<number>`count(*)::int`, buyer: sql<number>`count(*) filter (where ${couponRedemptions.email} = ${input.email.toLowerCase()})::int` })
        .from(couponRedemptions).where(eq(couponRedemptions.couponId, lockedCoupon.id));
      const pendingCounts = await tx.select({ total: sql<number>`count(*)::int`, buyer: sql<number>`count(*) filter (where ${orders.email} = ${input.email.toLowerCase()})::int` })
        .from(orders).where(and(eq(orders.couponCode, pricing.couponCode), eq(orders.status, "PENDING"), gt(orders.expiresAt, new Date())));
      const total = (redemptionCounts[0]?.total ?? 0) + (pendingCounts[0]?.total ?? 0);
      const buyer = (redemptionCounts[0]?.buyer ?? 0) + (pendingCounts[0]?.buyer ?? 0);
      if ((lockedCoupon.maxRedemptions !== null && total >= lockedCoupon.maxRedemptions) ||
          (lockedCoupon.maxPerUser > 0 && buyer >= lockedCoupon.maxPerUser)) {
        throw new CheckoutError("Kuota kupon sudah terpakai atau sedang dipakai pada pesanan yang belum selesai.");
      }
    }
    const inserted = await tx
      .insert(orders)
      .values({
        id: orderId,
        orderNumber,
        publicToken,
        userId: input.userId ?? null,
        email: input.email.toLowerCase(),
        mcUuid: player.uuid,
        mcName: player.name,
        edition: player.edition,
        seasonId: season.id,
        status: "PENDING",
        subtotalIdr: pricing.subtotalIdr,
        discountIdr: pricing.discountIdr,
        taxIdr: pricing.taxIdr,
        feeIdr: pricing.feeIdr,
        totalIdr: pricing.totalIdr,
        couponCode: pricing.couponCode,
        discountLabel: pricing.discountLabel,
        provider: input.provider,
        ip: input.ip,
        userAgent: input.userAgent.slice(0, 500),
        expiresAt,
      })
      .returning();

    for (const line of pricing.lines) {
      const recipient = resolvedItems.find(
        (item) => item.uuid === line.targetUuid && item.productId === line.productId,
      );
      await tx.insert(orderItems).values({
        id: ids.orderItem(),
        orderId,
        productId: line.productId,
        type: line.type,
        nameSnapshot: line.name,
        unitPriceIdr: line.unitPriceIdr,
        quantity: line.quantity,
        lineTotalIdr: line.lineTotalIdr,
        targetUuid: line.targetUuid,
        targetName: line.targetName,
        meta: {
          ...(line.upgradeFrom
            ? { upgradeFromProductId: line.upgradeFrom.productId, upgradeFromName: line.upgradeFrom.name }
            : {}),
          ...(recipient?.gift ? { giftFromName: player.name, giftFromUuid: player.uuid } : {}),
        },
      });
    }

    await tx.insert(legalAcceptances).values([
      {
        id: ids.legal(),
        userId: input.userId ?? null,
        email: input.email.toLowerCase(),
        docType: "TOS",
        version: input.legalVersions.tos,
        ip: input.ip,
      },
      {
        id: ids.legal(),
        userId: input.userId ?? null,
        email: input.email.toLowerCase(),
        docType: "PRIVACY",
        version: input.legalVersions.privacy,
        ip: input.ip,
      },
      {
        id: ids.legal(),
        userId: input.userId ?? null,
        email: input.email.toLowerCase(),
        docType: "SALES",
        version: input.legalVersions.sales,
        ip: input.ip,
      },
    ]);

    return inserted[0]!;
  });

  await upsertProfile({
    uuid: player.uuid,
    name: player.name,
    edition: player.edition,
  });
  for (const item of resolvedItems.filter((entry) => entry.gift)) {
    await upsertProfile({ uuid: item.uuid, name: item.name, edition: item.edition });
  }

  // Buat transaksi di gateway. Kalau gagal, order tetap PENDING dan bisa dicoba lagi.
  let paymentUrl: string | null = null;
  let payCode: string | null = null;
  try {
    const adapter = await getAdapter(input.provider);
    const payment = await adapter.createPayment({
      orderNumber,
      totalIdr: pricing.totalIdr,
      customerName: player.name,
      customerEmail: input.email,
      description: `${season.name} — ${pricing.lines.map((l) => l.name).join(", ")}`.slice(0, 120),
      // Gateways require item totals to equal the payable amount. The full item
      // breakdown and discount remain on our order/invoice; send a single net
      // line when discounts, tax or fees change the sum.
      items: pricing.totalIdr === pricing.subtotalIdr
        ? pricing.lines.map((l) => ({ name: l.name, priceIdr: l.unitPriceIdr, quantity: l.quantity }))
        : [{ name: `Pesanan ${orderNumber}`, priceIdr: pricing.totalIdr, quantity: 1 }],
      method,
      returnUrl: `${process.env.APP_URL}/pesanan/${publicToken}`,
      expiresInMinutes: settings.store.orderExpiryMinutes,
    });
    await db.insert(payments).values({
      id: ids.payment(),
      orderId,
      provider: input.provider,
      providerRef: payment.providerRef,
      method: payment.method,
      status: "PENDING",
      amountIdr: pricing.totalIdr,
      checkoutUrl: payment.checkoutUrl,
      payCode: payment.payCode,
      expiresAt: payment.expiresAt,
      rawCreate: payment.raw,
    });
    await db
      .update(orders)
      .set({ paymentRef: payment.providerRef, updatedAt: new Date() })
      .where(eq(orders.id, orderId));
    paymentUrl = payment.checkoutUrl;
    payCode = payment.payCode;
  } catch (error) {
    logger.error("payment_create_failed", {
      orderNumber,
      provider: input.provider,
      error: (error as Error).message,
    });
    if (error instanceof ProviderUnavailableError) {
      throw new CheckoutError("Metode pembayaran yang dipilih sedang tidak tersedia. Pilih metode lain.");
    }
    throw new CheckoutError("Gagal membuat transaksi pembayaran. Pesanan tersimpan — coba lagi dari halaman pesanan.");
  }

  await enqueue("email.send", { template: "order.created", orderId }, { dedupeKey: `email-created:${orderId}` });
  await enqueue("order.expire", { orderId }, { runAt: expiresAt, dedupeKey: `expire:${orderId}` });

  return {
    order: created,
    orderNumber,
    totalIdr: pricing.totalIdr,
    statusUrl: `/pesanan/${publicToken}`,
    paymentUrl,
    payCode,
    expiresAt,
  };
}

export async function loadCouponInput(code: string, email: string): Promise<CouponInput | null> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return null;
  const row = await db.query.coupons.findFirst({ where: eq(coupons.code, trimmed) });
  if (!row) return null;
  const total = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(couponRedemptions)
    .where(eq(couponRedemptions.couponId, row.id));
  const perUser = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(couponRedemptions)
    .where(and(eq(couponRedemptions.couponId, row.id), eq(couponRedemptions.email, email.toLowerCase())));
  return {
    code: row.code,
    type: row.type,
    value: row.value,
    minSubtotalIdr: row.minSubtotalIdr,
    tiers: row.tiers,
    seasonId: row.seasonId,
    maxRedemptions: row.maxRedemptions,
    maxPerUser: row.maxPerUser,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    active: row.active,
    rankOnly: row.rankOnly,
    kitOnly: row.kitOnly,
    eligibleItemsOnly: row.eligibleItemsOnly,
    redemptionsTotal: total[0]?.count ?? 0,
    redemptionsByBuyer: perUser[0]?.count ?? 0,
  };
}

export async function getOrderByPublicToken(token: string) {
  return db.query.orders.findFirst({
    columns: { id: true },
    where: eq(orders.publicToken, token),
  });
}

/** Hanya mutasi pembatalan yang perlu mengetahui keterkaitan akun dari token publik. */
export async function getOrderOwnershipByPublicToken(token: string) {
  return db.query.orders.findFirst({
    columns: { id: true, userId: true },
    where: eq(orders.publicToken, token),
  });
}

/** Detail pesanan untuk pembeli/email; proyeksi ini sengaja tidak memilih log mentah atau perintah server. */
export async function getOrderDetail(orderId: string) {
  const [orderRow] = await db
    .select({
      orderNumber: orders.orderNumber,
      publicToken: orders.publicToken,
      userId: orders.userId,
      email: orders.email,
      mcUuid: orders.mcUuid,
      mcName: orders.mcName,
      edition: orders.edition,
      seasonId: orders.seasonId,
      status: orders.status,
      subtotalIdr: orders.subtotalIdr,
      discountIdr: orders.discountIdr,
      discountLabel: orders.discountLabel,
      couponCode: orders.couponCode,
      taxIdr: orders.taxIdr,
      feeIdr: orders.feeIdr,
      totalIdr: orders.totalIdr,
      createdAt: orders.createdAt,
      expiresAt: orders.expiresAt,
      paidAt: orders.paidAt,
      deliveredAt: orders.deliveredAt,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!orderRow) return null;
  const { seasonId, ...order } = orderRow;

  const [items, paymentRows, deliveryRows, seasonRows] = await Promise.all([
    db
      .select({
        id: orderItems.id,
        type: orderItems.type,
        nameSnapshot: orderItems.nameSnapshot,
        targetName: orderItems.targetName,
        lineTotalIdr: orderItems.lineTotalIdr,
        meta: sql<OrderItem["meta"]>`case
          when ${orderItems.meta} is null then null
          else jsonb_strip_nulls(jsonb_build_object(
            'upgradeFromName', ${orderItems.meta} ->> 'upgradeFromName',
            'giftFromName', ${orderItems.meta} ->> 'giftFromName'
          ))
        end`,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId)),
    db
      .select({
        provider: payments.provider,
        providerRef: payments.providerRef,
        method: payments.method,
        status: payments.status,
        checkoutUrl: payments.checkoutUrl,
        payCode: payments.payCode,
        paidAt: payments.paidAt,
      })
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .orderBy(desc(payments.createdAt)),
    db
      .select({
        orderItemId: deliveries.orderItemId,
        status: deliveries.status,
        deliveredAt: deliveries.deliveredAt,
      })
      .from(deliveries)
      .where(eq(deliveries.orderId, orderId)),
    db.select({ name: seasons.name, endAt: seasons.endAt }).from(seasons).where(eq(seasons.id, seasonId)).limit(1),
  ]);
  return { order, items, payments: paymentRows, deliveries: deliveryRows, season: seasonRows[0] ?? null };
}

export interface PaidOrderResult {
  alreadyPaid: boolean;
  deliveriesCreated: number;
  orderId: string;
  cancelled?: boolean;
}

/**
 * Menandai order lunas dan menurunkan semua efek sampingnya (entitlement,
 * pengiriman, kupon, email). Aman dipanggil berulang: status order dikunci dan
 * diperiksa di dalam transaksi.
 */
export async function fulfillPaidOrder(input: {
  orderId: string;
  paymentId: string | null;
  amountIdr: number | null;
  method?: string | null;
}): Promise<PaidOrderResult> {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, input.orderId) });
  if (!order) throw new Error("Order tidak ditemukan");

  if (["PAID", "DELIVERING", "DELIVERED", "DISPUTED"].includes(order.status)) {
    return { alreadyPaid: true, deliveriesCreated: 0, orderId: order.id };
  }
  if (order.status === "CANCELLED") {
    return { alreadyPaid: false, deliveriesCreated: 0, orderId: order.id, cancelled: true };
  }

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const season = await db.query.seasons.findFirst({ where: eq(seasons.id, order.seasonId) });
  if (!season) throw new Error("Season order tidak ditemukan");

  // Siapkan perintah sebelum transaksi (query tambahan tidak boleh di dalam lock).
  const prepared: Array<{
    item: OrderItem;
    commands: string[];
    revokeCommands: string[];
    upgradeFromProductId?: string;
  }> = [];
  for (const item of items) {
    const product = await db.query.products.findFirst({ where: eq(products.id, item.productId) });
    if (!product || !product.useServerCommands) {
      prepared.push({ item, commands: [], revokeCommands: [] });
      continue;
    }
    const commands = await buildGrantCommands({
      productId: product.id,
      player: item.targetName,
      uuid: item.targetUuid,
      seasonSlug: season.slug,
    });
    const upgradeFromProductId = (item.meta as { upgradeFromProductId?: string } | null)?.upgradeFromProductId;
    let revokeCommands: string[] = [];
    if (upgradeFromProductId) {
      revokeCommands = await buildRevokeCommands({
        productId: upgradeFromProductId,
        player: item.targetName,
        uuid: item.targetUuid,
        seasonSlug: season.slug,
      });
    }
    prepared.push({ item, commands, revokeCommands, upgradeFromProductId });
  }

  const result = await db.transaction(async (tx) => {
    const locked = await tx.execute(sql`SELECT status FROM orders WHERE id = ${order.id} FOR UPDATE`);
    const currentStatus = (locked.rows[0] as { status: string } | undefined)?.status;
    if (!currentStatus) throw new Error("Order hilang");
    if (["PAID", "DELIVERING", "DELIVERED", "DISPUTED"].includes(currentStatus)) {
      return { alreadyPaid: true, deliveriesCreated: 0 };
    }
    if (currentStatus === "CANCELLED") return { alreadyPaid: false, deliveriesCreated: 0, cancelled: true };

    let couponQuotaConflict = false;
    if (order.couponCode) {
      const [lockedCoupon] = await tx.select().from(coupons).where(eq(coupons.code, order.couponCode)).limit(1).for("update");
      if (lockedCoupon) {
        const [redeemed] = await tx.select({ total: sql<number>`count(*)::int`, buyer: sql<number>`count(*) filter (where lower(${couponRedemptions.email}) = lower(${order.email}))::int` }).from(couponRedemptions).where(eq(couponRedemptions.couponId, lockedCoupon.id));
        const [reserved] = await tx.select({ total: sql<number>`count(*)::int`, buyer: sql<number>`count(*) filter (where lower(${orders.email}) = lower(${order.email}))::int` }).from(orders).where(and(eq(orders.couponCode, order.couponCode), eq(orders.status, "PENDING"), gt(orders.expiresAt, new Date()), sql`${orders.id} <> ${order.id}`));
        couponQuotaConflict = (lockedCoupon.maxRedemptions !== null && (redeemed?.total ?? 0) + (reserved?.total ?? 0) >= lockedCoupon.maxRedemptions)
          || (lockedCoupon.maxPerUser > 0 && (redeemed?.buyer ?? 0) + (reserved?.buyer ?? 0) >= lockedCoupon.maxPerUser);
      }
    }

    await tx
      .update(orders)
      .set({ status: "PAID", paidAt: new Date(), updatedAt: new Date() })
      .where(eq(orders.id, order.id));

    if (input.paymentId) {
      await tx
        .update(payments)
        .set({
          status: "PAID",
          paidAt: new Date(),
          updatedAt: new Date(),
          ...(input.method ? { method: input.method } : {}),
        })
        .where(eq(payments.id, input.paymentId));
    }
    const otherPayments = await tx.select().from(payments).where(eq(payments.orderId, order.id));
    for (const payment of otherPayments) {
      if (payment.id !== input.paymentId && payment.status === "PENDING") {
        await tx
          .update(payments)
          .set({ status: "DUPLICATE", updatedAt: new Date() })
          .where(eq(payments.id, payment.id));
      }
    }

    let deliveriesCreated = 0;
    for (const entry of prepared) {
      const { item } = entry;

      // Entitlement: rank lama (tier lebih rendah) dinonaktifkan saat upgrade.
      if (entry.upgradeFromProductId) {
        await tx
          .update(entitlements)
          .set({ active: false, revokedAt: new Date(), updatedAt: new Date() })
          .where(
            and(
              eq(entitlements.uuid, item.targetUuid),
              eq(entitlements.productId, entry.upgradeFromProductId),
              eq(entitlements.seasonId, order.seasonId),
            ),
          );
      }
      await tx
        .insert(entitlements)
        .values({
          id: ids.entitlement(),
          uuid: item.targetUuid,
          productId: item.productId,
          seasonId: order.seasonId,
          orderId: order.id,
          source: "PURCHASE",
          active: true,
          playerName: item.targetName,
        })
        .onConflictDoUpdate({
          target: [entitlements.uuid, entitlements.productId, entitlements.seasonId],
          set: { active: true, revokedAt: null, orderId: order.id, updatedAt: new Date() },
        });

      if (entry.commands.length > 0 || entry.revokeCommands.length > 0) {
        await tx.insert(deliveries).values({
          id: ids.delivery(),
          orderId: order.id,
          orderItemId: item.id,
          seasonId: order.seasonId,
          uuid: item.targetUuid,
          playerName: item.targetName,
          productId: item.productId,
          status: "QUEUED",
          commands: [...entry.revokeCommands, ...entry.commands],
        });
        deliveriesCreated += 1;
      }
    }

    if (order.couponCode) {
      const coupon = await tx.query.coupons.findFirst({ where: eq(coupons.code, order.couponCode) });
      if (coupon) {
        await tx
          .insert(couponRedemptions)
          .values({
            id: ids.couponRedemption(),
            couponId: coupon.id,
            orderId: order.id,
            userId: order.userId,
            email: order.email,
            amountIdr: order.discountIdr,
          })
          .onConflictDoNothing({ target: couponRedemptions.orderId });
      }
    }

    if (order.userId) {
      const [buyer] = await tx.select({ enabled: users.dashboardOrderUpdates }).from(users).where(eq(users.id, order.userId)).limit(1);
      if (buyer?.enabled) await tx.insert(notifications).values({ id: ids.notification(), userId: order.userId, kind: "ORDER_PAID", title: "Pembayaran diterima", body: `Pembayaran untuk ${order.orderNumber} sudah tercatat dan sedang diproses.`, href: `/dashboard/pesanan/${order.id}` });
    }
    if (couponQuotaConflict) {
      // Honor the accepted price when money arrives late; do not silently hide
      // the conflict with another reservation or redeemed coupon.
      await tx.insert(notifications).values({ id: ids.notification(), kind: "PAYMENT_ANOMALY", title: "Kuota kupon perlu ditinjau", body: `Pembayaran ${order.orderNumber} memakai kupon ${order.couponCode} setelah kuota sudah terpakai atau direservasi order lain. Pesanan tetap dipenuhi; periksa pemakaian kupon.`, href: `/admin/pesanan/${order.id}` });
    }
    // Keep payment, delivery and their jobs atomic: a crash must not leave a
    // paid order without the jobs needed to notify and process it.
    await tx.insert(jobs).values({ id: ids.job(), type: "email.send", payload: { template: "order.paid", orderId: order.id }, dedupeKey: `email-paid:${order.id}` }).onConflictDoNothing({ target: jobs.dedupeKey });
    if (deliveriesCreated > 0) {
      await tx.insert(jobs).values({ id: ids.job(), type: "delivery.process", payload: { orderId: order.id }, dedupeKey: `deliver:${order.id}` }).onConflictDoNothing({ target: jobs.dedupeKey });
    } else {
      await tx.update(orders).set({ status: "DELIVERED", deliveredAt: new Date(), updatedAt: new Date() }).where(eq(orders.id, order.id));
    }
    return { alreadyPaid: false, deliveriesCreated };
  });

  return { ...result, orderId: order.id };
}

export async function markOrderDisputed(orderId: string, reason: string): Promise<void> {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) return;
  await db
    .update(orders)
    .set({ status: "DISPUTED", adminNote: `Sengketa: ${reason}`.slice(0, 500), updatedAt: new Date() })
    .where(eq(orders.id, orderId));
  await enqueue("email.send", { template: "order.disputed", orderId }, { dedupeKey: `email-dispute:${orderId}` });
}

/** Expire order PENDING yang sudah lewat waktu (idempoten). */
export async function expirePendingOrders(now = new Date()): Promise<number> {
  const stale = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.status, "PENDING"), lt(orders.expiresAt, now)))
    .limit(200);
  if (stale.length === 0) return 0;
  let count = 0;
  for (const row of stale) {
    const updated = await db
      .update(orders)
      .set({ status: "EXPIRED", updatedAt: new Date() })
      .where(and(eq(orders.id, row.id), eq(orders.status, "PENDING")))
      .returning({ id: orders.id });
    if (updated.length > 0) {
      await db.update(payments).set({ status: "EXPIRED" }).where(and(eq(payments.orderId, row.id), eq(payments.status, "PENDING")));
      count += 1;
    }
  }
  return count;
}

export async function ordersForUser(userId: string, limit = 20) {
  return db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}

export async function orderHistoryForUser(userId: string, rawCursor?: string) {
  const cursor = decodeCursor(rawCursor);
  const rows = await db.select({ id: orders.id, cursorAt: cursorTimestamp(orders.createdAt), orderNumber: orders.orderNumber, createdAt: orders.createdAt, mcName: orders.mcName, seasonId: orders.seasonId, totalIdr: orders.totalIdr, status: orders.status })
    .from(orders).where(and(eq(orders.userId, userId), cursorCondition(orders.createdAt, orders.id, cursor)))
    .orderBy(...cursorOrder(orders.createdAt, orders.id, cursor)).limit(PAGE_SIZE + 1);
  return cursorPage(rows, cursor);
}

export async function cancelOrder(orderId: string, userId: string | null): Promise<boolean> {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) return false;
  if (userId && order.userId !== userId) return false;
  if (order.status !== "PENDING") return false;
  await db
    .update(orders)
    .set({ status: "CANCELLED", cancelledAt: new Date(), updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.status, "PENDING")));
  await db.update(payments).set({ status: "FAILED" }).where(and(eq(payments.orderId, orderId), eq(payments.status, "PENDING")));
  return true;
}

/** Pencarian pesanan untuk tamu: nomor order + email harus cocok. */
export async function findOrderForLookup(orderNumber: string, email: string) {
  return db.query.orders.findFirst({
    where: and(eq(orders.orderNumber, orderNumber.trim().toUpperCase()), eq(orders.email, email.trim().toLowerCase())),
  });
}
