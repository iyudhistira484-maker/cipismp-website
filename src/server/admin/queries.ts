import { and, count, desc, eq, gte, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import {
  auditLogs,
  coupons,
  couponRedemptions,
  deliveries,
  deliveryAttempts,
  entitlements,
  orders,
  payments,
  products,
  seasons,
  servers,
  users,
} from "../db/schema";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/order-state";

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

export async function analyticsSummary(now = new Date()): Promise<AnalyticsSummary> {
  const dayStart = new Date(now.getTime() - 24 * 3_600_000);

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

  const [customerRow] = await db.select({ total: count() }).from(users).where(eq(users.role, "CUSTOMER"));
  const [deadRow] = await db.select({ total: count() }).from(deliveries).where(eq(deliveries.status, "DEAD"));
  const [failedRow] = await db.select({ total: count() }).from(orders).where(eq(orders.status, "FAILED"));

  const activeSeason = await db.query.seasons.findFirst({
    where: eq(seasons.status, "ACTIVE"),
    orderBy: [desc(seasons.startAt)],
  });

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

/** Data lengkap satu produk untuk form edit (termasuk tagline/deskripsi/perks). */
export async function productForEdit(productId: string) {
  return db.query.products.findFirst({ where: eq(products.id, productId) });
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

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      role: users.role,
      emailVerifiedAt: users.emailVerifiedAt,
      totpEnabledAt: users.totpEnabledAt,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(clause)
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
      orderId: payments.orderId,
      provider: payments.provider,
      status: payments.status,
      amountIdr: payments.amountIdr,
      providerRef: payments.providerRef,
      createdAt: payments.createdAt,
      orderNumber: orders.orderNumber,
    })
    .from(payments)
    .innerJoin(orders, eq(payments.orderId, orders.id))
    .where(and(inArray(payments.status, ["PENDING", "UNDERPAID"]), isNull(orders.paidAt)))
    .orderBy(desc(payments.createdAt))
    .limit(limit);
}

export async function recentWebhookEvents(limit = 20) {
  return db.query.paymentEvents.findMany({
    orderBy: (table, { desc: descFn }) => [descFn(table.receivedAt)],
    limit,
  });
}
