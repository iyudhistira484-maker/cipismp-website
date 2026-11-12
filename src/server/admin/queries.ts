import { and, count, desc, eq, gte, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import {
  auditLogs,
  automaticDiscounts,
  coupons,
  couponRedemptions,
  commandTemplates,
  deliveries,
  deliveryAttempts,
  entitlements,
  kitItems,
  minecraftProfiles,
  orders,
  orderItems,
  paymentEvents,
  payments,
  products,
  seasons,
  servers,
  sessions,
  users,
} from "../db/schema";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/order-state";
import { jakartaDateKey, MS_DAY, startOfWibDay } from "@/lib/dates";
import { entitlementsForUser } from "../entitlements";

const PAID_STATUSES: OrderStatus[] = ["PAID", "DELIVERING", "DELIVERED", "DISPUTED"];

export interface AnalyticsSummary {
  revenueAllIdr: number;
  revenueTodayIdr: number;
  revenue7dIdr: number;
  revenue30dIdr: number;
  orderCounts: Record<string, number>;
  paidOrders: number;
  pendingOrders: number;
  customers: number;
  activeSeason: { id: string; name: string; endAt: Date } | null;
  needsAttention: number;
  deadDeliveries: number;
  pendingJobs: number;
}

function idr(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

export async function analyticsSummary(
  now = new Date(),
  options: { includeDeliveryMetrics?: boolean } = {},
): Promise<AnalyticsSummary> {
  const dayStart = startOfWibDay(now);
  const includeDeliveryMetrics = options.includeDeliveryMetrics ?? false;

  const [totals] = await db
    .select({
      all: sql<string>`coalesce(sum(${orders.totalIdr}), 0)`,
      today: sql<string>`coalesce(sum(case when ${orders.paidAt} >= ${dayStart} then ${orders.totalIdr} else 0 end), 0)`,
      d7: sql<string>`coalesce(sum(case when ${orders.paidAt} >= ${new Date(now.getTime() - 7 * 86_400_000)} then ${orders.totalIdr} else 0 end), 0)`,
      d30: sql<string>`coalesce(sum(case when ${orders.paidAt} >= ${new Date(now.getTime() - 30 * 86_400_000)} then ${orders.totalIdr} else 0 end), 0)`,
      paid: sql<string>`count(*)`,
    })
    .from(orders)
    .where(inArray(orders.status, PAID_STATUSES));

  const statusRows = await db
    .select({ status: orders.status, total: count() })
    .from(orders)
    .groupBy(orders.status);

  const orderCounts: Record<string, number> = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0]));
  for (const row of statusRows) orderCounts[row.status] = Number(row.total);

  const [[customerRow], [deadRow], [failedRow], activeSeason] = await Promise.all([
    db.select({ total: count() }).from(users).where(eq(users.role, "CUSTOMER")),
    includeDeliveryMetrics
      ? db.select({ total: count() }).from(deliveries).where(eq(deliveries.status, "DEAD"))
      : Promise.resolve([]),
    db.select({ total: count() }).from(orders).where(eq(orders.status, "FAILED")),
    db.query.seasons.findFirst({
      where: eq(seasons.status, "ACTIVE"),
      orderBy: [desc(seasons.startAt)],
    }),
  ]);

  return {
    revenueAllIdr: idr(totals?.all),
    revenueTodayIdr: idr(totals?.today),
    revenue7dIdr: idr(totals?.d7),
    revenue30dIdr: idr(totals?.d30),
    orderCounts,
    paidOrders: Number(totals?.paid ?? 0),
    pendingOrders: orderCounts.PENDING ?? 0,
    customers: Number(customerRow?.total ?? 0),
    activeSeason: activeSeason ? { id: activeSeason.id, name: activeSeason.name, endAt: activeSeason.endAt } : null,
    needsAttention: Number(failedRow?.total ?? 0) + Number(deadRow?.total ?? 0),
    deadDeliveries: Number(deadRow?.total ?? 0),
    pendingJobs: 0,
  };
}

export interface RevenuePoint {
  day: string; // YYYY-MM-DD (Asia/Jakarta)
  revenueIdr: number;
  orders: number;
}

/** Pendapatan per hari (WIB) dari order yang sudah dibayar. */
export async function revenueTrend(days = 30, now = new Date()): Promise<RevenuePoint[]> {
  const todayStart = startOfWibDay(now);
  const from = new Date(todayStart.getTime() - (days - 1) * MS_DAY);
  const rows = await db
    .select({
      day: sql<string>`to_char((${orders.paidAt} AT TIME ZONE 'Asia/Jakarta')::date, 'YYYY-MM-DD')`,
      revenue: sql<string>`coalesce(sum(${orders.totalIdr}), 0)`,
      total: sql<string>`count(*)`,
    })
    .from(orders)
    .where(and(inArray(orders.status, PAID_STATUSES), gte(orders.paidAt, from)))
    .groupBy(sql`(${orders.paidAt} AT TIME ZONE 'Asia/Jakarta')::date`)
    .orderBy(sql`(${orders.paidAt} AT TIME ZONE 'Asia/Jakarta')::date`);

  const map = new Map(rows.map((row) => [row.day, { revenueIdr: idr(row.revenue), orders: Number(row.total) }]));
  const out: RevenuePoint[] = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(todayStart.getTime() - index * MS_DAY);
    const key = jakartaDateKey(date);
    const entry = map.get(key);
    out.push({ day: key, revenueIdr: entry?.revenueIdr ?? 0, orders: entry?.orders ?? 0 });
  }
  return out;
}

export interface StaffSessionRow {
  id: string;
  userId: string;
  email: string;
  role: string;
  ip: string | null;
  userAgent: string | null;
  lastSeenAt: Date;
  absoluteExpiresAt: Date;
  mfaSatisfiedAt: Date | null;
}

/** Sesi aktif milik semua akun staf (untuk pencabutan paksa). */
export async function staffSessions(): Promise<StaffSessionRow[]> {
  const rows = await db
    .select({
      id: sessions.id,
      userId: sessions.userId,
      email: users.email,
      role: users.role,
      ip: sessions.ip,
      userAgent: sessions.userAgent,
      lastSeenAt: sessions.lastSeenAt,
      absoluteExpiresAt: sessions.absoluteExpiresAt,
      mfaSatisfiedAt: sessions.mfaSatisfiedAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        inArray(users.role, ["OWNER", "ADMIN", "SUPPORT"]),
        isNull(sessions.revokedAt),
        gte(sessions.absoluteExpiresAt, new Date()),
      ),
    )
    .orderBy(desc(sessions.lastSeenAt));
  return rows;
}

export interface OrderFilters {
  status?: string;
  query?: string;
  limit?: number;
}

export async function listOrders(filters: OrderFilters = {}) {
  const conditions: SQL[] = [];
  if (filters.status && ORDER_STATUSES.includes(filters.status as OrderStatus)) {
    conditions.push(eq(orders.status, filters.status as OrderStatus));
  }
  const q = filters.query?.trim();
  if (q) {
    const pattern = `%${q}%`;
    const clause = or(
      ilike(orders.orderNumber, pattern),
      ilike(orders.email, pattern),
      ilike(orders.mcName, pattern),
    );
    if (clause) conditions.push(clause);
  }

  return db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      email: orders.email,
      mcName: orders.mcName,
      status: orders.status,
      totalIdr: orders.totalIdr,
      provider: orders.provider,
      createdAt: orders.createdAt,
      paidAt: orders.paidAt,
    })
    .from(orders)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(filters.limit ?? 50);
}

/** Detail order untuk staf dengan proyeksi minimum; sengaja tanpa metadata pembayaran mentah, IP/UA, atau perintah delivery. */
export async function adminOrderDetail(orderId: string) {
  const [order] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      publicToken: orders.publicToken,
      email: orders.email,
      mcName: orders.mcName,
      provider: orders.provider,
      status: orders.status,
      subtotalIdr: orders.subtotalIdr,
      discountIdr: orders.discountIdr,
      discountLabel: orders.discountLabel,
      couponCode: orders.couponCode,
      taxIdr: orders.taxIdr,
      feeIdr: orders.feeIdr,
      totalIdr: orders.totalIdr,
      adminNote: orders.adminNote,
      createdAt: orders.createdAt,
      expiresAt: orders.expiresAt,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) return null;

  const [items, paymentRows, deliveryRows, seasonRows] = await Promise.all([
    db
      .select({
        id: orderItems.id,
        nameSnapshot: orderItems.nameSnapshot,
        targetName: orderItems.targetName,
        unitPriceIdr: orderItems.unitPriceIdr,
        quantity: orderItems.quantity,
        lineTotalIdr: orderItems.lineTotalIdr,
        giftFromName: sql<string | null>`${orderItems.meta} ->> 'giftFromName'`,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId)),
    db
      .select({
        id: payments.id,
        provider: payments.provider,
        providerRef: payments.providerRef,
        status: payments.status,
        amountIdr: payments.amountIdr,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .orderBy(desc(payments.createdAt)),
    db
      .select({
        id: deliveries.id,
        playerName: deliveries.playerName,
        status: deliveries.status,
        method: deliveries.method,
        attempts: deliveries.attempts,
        lastError: deliveries.lastError,
      })
      .from(deliveries)
      .where(eq(deliveries.orderId, orderId)),
    db
      .select({ name: seasons.name })
      .from(seasons)
      .innerJoin(orders, eq(seasons.id, orders.seasonId))
      .where(eq(orders.id, orderId))
      .limit(1),
  ]);

  return { order, items, payments: paymentRows, deliveries: deliveryRows, season: seasonRows[0] ?? null };
}

export async function listPublishedProductsForComp() {
  return db
    .select({ id: products.id, name: products.name, type: products.type })
    .from(products)
    .where(and(eq(products.status, "PUBLISHED"), isNull(products.deletedAt)))
    .orderBy(products.type, products.tier);
}

export async function listProductsForAdmin() {
  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      type: products.type,
      status: products.status,
      priceIdr: products.priceIdr,
      tier: products.tier,
      maxPerSeason: products.maxPerSeason,
      cooldownHours: products.cooldownHours,
      sortOrder: products.sortOrder,
      deletedAt: products.deletedAt,
    })
    .from(products)
    .orderBy(products.type, products.tier, products.sortOrder);

  const sold = await db
    .select({ productId: entitlements.productId, total: count() })
    .from(entitlements)
    .groupBy(entitlements.productId);
  const soldMap = new Map(sold.map((row) => [row.productId, Number(row.total)]));

  return rows.map((row) => ({ ...row, soldCount: soldMap.get(row.id) ?? 0 }));
}

/** Data lengkap satu produk untuk form admin, termasuk command & isi kit. */
export async function productForEdit(productId: string) {
  const product = await db.query.products.findFirst({ where: eq(products.id, productId) });
  if (!product) return undefined;
  const [commands, items] = await Promise.all([
    db.select().from(commandTemplates).where(eq(commandTemplates.productId, productId)),
    db.select().from(kitItems).where(eq(kitItems.productId, productId)).orderBy(kitItems.slot),
  ]);
  return {
    ...product,
    grantTemplate: commands.find((command) => command.kind === "GRANT")?.template ?? "",
    revokeTemplate: commands.find((command) => command.kind === "REVOKE")?.template ?? "",
    kitItems: items,
  };
}

export async function listSeasonsForAdmin() {
  const rows = await db.select().from(seasons).orderBy(desc(seasons.startAt));
  const counts = await db
    .select({ seasonId: entitlements.seasonId, total: count() })
    .from(entitlements)
    .where(eq(entitlements.active, true))
    .groupBy(entitlements.seasonId);
  const map = new Map(counts.map((row) => [row.seasonId, Number(row.total)]));
  return rows.map((row) => ({ ...row, activeEntitlements: map.get(row.id) ?? 0 }));
}

export async function listCustomers(query?: string, limit = 50) {
  const q = query?.trim();
  const pattern = `%${q ?? ""}%`;
  const clause = q ? or(ilike(users.email, pattern), ilike(users.username, pattern)) : undefined;
  const conditions: SQL[] = [eq(users.role, "CUSTOMER")];
  if (clause) conditions.push(clause);

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(...conditions))
    .orderBy(desc(users.createdAt))
    .limit(limit);

  const spend = await db
    .select({ userId: orders.userId, total: sql<string>`coalesce(sum(${orders.totalIdr}), 0)`, orders: count() })
    .from(orders)
    .where(inArray(orders.status, PAID_STATUSES))
    .groupBy(orders.userId);
  const spendMap = new Map(spend.map((row) => [row.userId, { totalIdr: idr(row.total), orderCount: Number(row.orders) }]));

  return rows.map((row) => ({
    ...row,
    totalSpentIdr: spendMap.get(row.id)?.totalIdr ?? 0,
    paidOrderCount: spendMap.get(row.id)?.orderCount ?? 0,
  }));
}

/** Ringkasan aman untuk halaman detail pelanggan; tidak memilih hash/secret autentikasi. */
export async function customerDetail(
  userId: string,
  options: { includeOrders?: boolean; includeEntitlements?: boolean } = {},
) {
  const [customer] = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      role: users.role,
      emailVerifiedAt: users.emailVerifiedAt,
      totpEnabledAt: users.totpEnabledAt,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.role, "CUSTOMER")))
    .limit(1);
  if (!customer) return null;

  const [profiles, customerOrders, customerEntitlements] = await Promise.all([
    db
      .select({ uuid: minecraftProfiles.uuid, edition: minecraftProfiles.edition, displayName: minecraftProfiles.displayName, verifiedAt: minecraftProfiles.verifiedAt, lastSyncedAt: minecraftProfiles.lastSyncedAt })
      .from(minecraftProfiles)
      .where(eq(minecraftProfiles.userId, userId))
      .orderBy(desc(minecraftProfiles.updatedAt)),
    options.includeOrders === false
      ? Promise.resolve([])
      : db
          .select({ id: orders.id, orderNumber: orders.orderNumber, mcName: orders.mcName, status: orders.status, totalIdr: orders.totalIdr, createdAt: orders.createdAt, paidAt: orders.paidAt })
          .from(orders)
          .where(eq(orders.userId, userId))
          .orderBy(desc(orders.createdAt))
          .limit(50),
    options.includeEntitlements === false ? Promise.resolve([]) : entitlementsForUser(userId),
  ]);

  return { customer, profiles, orders: customerOrders, entitlements: customerEntitlements };
}

export async function listCouponsForAdmin() {
  const rows = await db.select().from(coupons).orderBy(desc(coupons.createdAt));
  const redemptions = await db
    .select({ couponId: couponRedemptions.couponId, total: count(), amount: sql<string>`coalesce(sum(${couponRedemptions.amountIdr}), 0)` })
    .from(couponRedemptions)
    .groupBy(couponRedemptions.couponId);
  const map = new Map(redemptions.map((row) => [row.couponId, { count: Number(row.total), amountIdr: idr(row.amount) }]));
  return rows.map((row) => ({
    ...row,
    redeemedCount: map.get(row.id)?.count ?? 0,
    discountGivenIdr: map.get(row.id)?.amountIdr ?? 0,
  }));
}

export async function listAutomaticDiscountsForAdmin() {
  return db.select().from(automaticDiscounts).orderBy(desc(automaticDiscounts.createdAt));
}

export async function listStaffAccounts() {
  return db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      role: users.role,
      totpEnabledAt: users.totpEnabledAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(inArray(users.role, ["OWNER", "ADMIN", "SUPPORT"]))
    .orderBy(users.role, users.email);
}

export async function listAuditTrail(filters: { action?: string; limit?: number } = {}) {
  const conditions: SQL[] = [];
  if (filters.action) conditions.push(ilike(auditLogs.action, `%${filters.action}%`));
  return db
    .select()
    .from(auditLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(filters.limit ?? 100);
}

/** Ringkasan dashboard tanpa error, referensi order, atau detail percobaan. */
export async function deliveryOverview(limit = 8) {
  const [rows, counts] = await Promise.all([
    db
      .select({
        id: deliveries.id,
        playerName: deliveries.playerName,
        status: deliveries.status,
        attempts: deliveries.attempts,
      })
      .from(deliveries)
      .orderBy(desc(deliveries.updatedAt))
      .limit(limit),
    db.select({ status: deliveries.status, total: count() }).from(deliveries).groupBy(deliveries.status),
  ]);

  const stats = { QUEUED: 0, SENT: 0, DELIVERED: 0, FAILED: 0, DEAD: 0 } as Record<string, number>;
  for (const row of counts) stats[row.status] = Number(row.total);

  return { rows, stats };
}

export async function deliveryMonitor(limit = 100) {
  const rows = await db
    .select({
      id: deliveries.id,
      orderId: deliveries.orderId,
      playerName: deliveries.playerName,
      status: deliveries.status,
      method: deliveries.method,
      attempts: deliveries.attempts,
      lastError: deliveries.lastError,
      updatedAt: deliveries.updatedAt,
      nextAttemptAt: deliveries.nextAttemptAt,
      orderNumber: orders.orderNumber,
    })
    .from(deliveries)
    .leftJoin(orders, eq(deliveries.orderId, orders.id))
    .orderBy(desc(deliveries.updatedAt))
    .limit(limit);

  const attempts = await db
    .select({ deliveryId: deliveryAttempts.deliveryId, total: count() })
    .from(deliveryAttempts)
    .groupBy(deliveryAttempts.deliveryId);
  const map = new Map(attempts.map((row) => [row.deliveryId, Number(row.total)]));

  const stats = {
    QUEUED: 0,
    SENT: 0,
    DELIVERED: 0,
    FAILED: 0,
    DEAD: 0,
  } as Record<string, number>;
  const counts = await db.select({ status: deliveries.status, total: count() }).from(deliveries).groupBy(deliveries.status);
  for (const row of counts) stats[row.status] = Number(row.total);

  return { rows: rows.map((row) => ({ ...row, attemptRows: map.get(row.id) ?? 0 })), stats };
}

export async function defaultServerRow() {
  return db.query.servers.findFirst({ where: eq(servers.isDefault, true) });
}

export async function pendingPaymentRows(limit = 20) {
  return db
    .select({
      id: payments.id,
      provider: payments.provider,
      status: payments.status,
      amountIdr: payments.amountIdr,
      createdAt: payments.createdAt,
      orderNumber: orders.orderNumber,
    })
    .from(payments)
    .innerJoin(orders, eq(payments.orderId, orders.id))
    .where(and(inArray(payments.status, ["PENDING", "UNDERPAID"]), isNull(orders.paidAt)))
    .orderBy(desc(payments.createdAt))
    .limit(limit);
}

/** Ringkasan webhook; raw payload, header, IP, dan dedupe key tidak dimuat ke panel. */
export async function recentWebhookEvents(limit = 20) {
  return db
    .select({
      id: paymentEvents.id,
      provider: paymentEvents.provider,
      eventType: paymentEvents.eventType,
      signatureValid: paymentEvents.signatureValid,
      receivedAt: paymentEvents.receivedAt,
      result: paymentEvents.result,
    })
    .from(paymentEvents)
    .orderBy(desc(paymentEvents.receivedAt))
    .limit(limit);
}
