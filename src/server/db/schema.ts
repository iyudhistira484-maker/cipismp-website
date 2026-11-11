/**
 * Skema database CipiSMP Store (PostgreSQL + Drizzle ORM).
 *
 * Konvensi:
 * - Uang selalu integer rupiah (kolom *_idr). Tidak pernah float.
 * - Waktu selalu UTC (timestamptz); format ke Asia/Jakarta hanya di lapisan UI.
 * - Nama kolom snake_case, nama properti TypeScript camelCase.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();

export const roleEnum = pgEnum("role", ["OWNER", "ADMIN", "SUPPORT", "CUSTOMER"]);
export const editionEnum = pgEnum("edition", ["JAVA", "BEDROCK"]);
export const productTypeEnum = pgEnum("product_type", ["RANK", "KIT"]);
export const productStatusEnum = pgEnum("product_status", ["DRAFT", "PUBLISHED"]);
export const seasonStatusEnum = pgEnum("season_status", ["UPCOMING", "ACTIVE", "ENDED"]);
export const orderStatusEnum = pgEnum("order_status", [
  "PENDING",
  "PAID",
  "DELIVERING",
  "DELIVERED",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
  "DISPUTED",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "PENDING",
  "PAID",
  "FAILED",
  "EXPIRED",
  "DUPLICATE",
  "UNDERPAID",
  "OVERPAID",
  "DISPUTED",
]);
export const paymentProviderEnum = pgEnum("payment_provider", ["TRIPAY", "MIDTRANS", "FAKE"]);
export const deliveryStatusEnum = pgEnum("delivery_status", [
  "QUEUED",
  "SENT",
  "DELIVERED",
  "FAILED",
  "DEAD",
]);
export const deliveryMethodEnum = pgEnum("delivery_method", ["PLUGIN", "RCON"]);
export const tokenTypeEnum = pgEnum("token_type", [
  "EMAIL_VERIFY",
  "PASSWORD_RESET",
  "EMAIL_CHANGE",
  "MC_VERIFY",
]);
export const jobStatusEnum = pgEnum("job_status", ["PENDING", "RUNNING", "DONE", "FAILED", "DEAD"]);
export const couponTypeEnum = pgEnum("coupon_type", ["PERCENT", "FIXED"]);
export const entitlementSourceEnum = pgEnum("entitlement_source", ["PURCHASE", "COMP"]);
export const commandKindEnum = pgEnum("command_kind", ["GRANT", "REVOKE"]);
export const emailStatusEnum = pgEnum("email_status", ["QUEUED", "SENT", "FAILED"]);
export const notificationKindEnum = pgEnum("notification_kind", [
  "ORDER_PAID",
  "ORDER_DELIVERED",
  "ORDER_FAILED",
  "DISPUTE",
  "PAYMENT_ANOMALY",
  "DELIVERY_DEAD",
  "SEASON_ENDING",
  "SYSTEM",
]);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    emailVerifiedAt: ts("email_verified_at"),
    username: text("username").notNull(),
    displayName: text("display_name"),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull().default("CUSTOMER"),
    totpSecret: text("totp_secret"),
    totpEnabledAt: ts("totp_enabled_at"),
    totpLastStep: integer("totp_last_step"),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: ts("locked_until"),
    lastLoginAt: ts("last_login_at"),
    lastLoginIp: text("last_login_ip"),
    marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [
    uniqueIndex("users_email_uq").on(sql`lower(${t.email})`),
    uniqueIndex("users_username_uq").on(sql`lower(${t.username})`),
    index("users_role_idx").on(t.role),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    absoluteExpiresAt: ts("absolute_expires_at").notNull(),
    idleExpiresAt: ts("idle_expires_at").notNull(),
    revokedAt: ts("revoked_at"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    mfaSatisfiedAt: ts("mfa_satisfied_at"),
    rememberMe: boolean("remember_me").notNull().default(false),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_idle_idx").on(t.idleExpiresAt)],
);

export const authTokens = pgTable(
  "auth_tokens",
  {
    id: text("id").primaryKey(),
    type: tokenTypeEnum("type").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    email: text("email"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    createdAt: createdAt(),
  },
  (t) => [index("auth_tokens_user_idx").on(t.userId, t.type), index("auth_tokens_exp_idx").on(t.expiresAt)],
);

export const legalAcceptances = pgTable("legal_acceptances", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  email: text("email"),
  docType: text("doc_type").notNull(),
  version: text("version").notNull(),
  acceptedAt: ts("accepted_at").notNull().defaultNow(),
  ip: text("ip"),
});

export const minecraftProfiles = pgTable(
  "minecraft_profiles",
  {
    id: text("id").primaryKey(),
    uuid: text("uuid").notNull().unique(),
    edition: editionEnum("edition").notNull(),
    displayName: text("display_name").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    verifiedAt: ts("verified_at"),
    lastSyncedAt: ts("last_synced_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("mc_profiles_user_idx").on(t.userId), index("mc_profiles_name_idx").on(sql`lower(${t.displayName})`)],
);

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    type: productTypeEnum("type").notNull(),
    name: text("name").notNull(),
    tagline: text("tagline").notNull(),
    description: text("description").notNull(),
    priceIdr: integer("price_idr").notNull(),
    tier: integer("tier").notNull().default(0),
    accent: text("accent").notNull().default("amber"),
    status: productStatusEnum("status").notNull().default("DRAFT"),
    sortOrder: integer("sort_order").notNull().default(0),
    maxPerSeason: integer("max_per_season").notNull().default(1),
    cooldownHours: integer("cooldown_hours").notNull().default(0),
    useServerCommands: boolean("use_server_commands").notNull().default(true),
    perks: text("perks").array().notNull().default(sql`'{}'::text[]`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("products_type_status_idx").on(t.type, t.status, t.sortOrder)],
);

export const kitItems = pgTable(
  "kit_items",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    slot: integer("slot").notNull().default(0),
    itemKey: text("item_key").notNull(),
    name: text("name").notNull(),
    quantity: integer("quantity").notNull().default(1),
    enchantments: text("enchantments").array().notNull().default(sql`'{}'::text[]`),
    lore: text("lore").array().notNull().default(sql`'{}'::text[]`),
  },
  (t) => [index("kit_items_product_idx").on(t.productId, t.slot)],
);

export const commandTemplates = pgTable(
  "command_templates",
  {
    id: text("id").primaryKey(),
    productId: text("product_id").references(() => products.id, { onDelete: "cascade" }),
    kind: commandKindEnum("kind").notNull(),
    template: text("template").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("command_templates_uq").on(t.productId, t.kind)],
);

export const servers = pgTable("servers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  javaHost: text("java_host").notNull(),
  javaPort: integer("java_port").notNull().default(25565),
  bedrockHost: text("bedrock_host").notNull(),
  bedrockPort: integer("bedrock_port").notNull().default(19202),
  deliveryMode: deliveryMethodEnum("delivery_mode").notNull().default("PLUGIN"),
  pluginBaseUrl: text("plugin_base_url"),
  pluginSecret: text("plugin_secret"),
  rconHost: text("rcon_host"),
  rconPort: integer("rcon_port").default(25575),
  rconPassword: text("rcon_password"),
  statusApiUrl: text("status_api_url"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const seasons = pgTable(
  "seasons",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    startAt: ts("start_at").notNull(),
    endAt: ts("end_at").notNull(),
    status: seasonStatusEnum("status").notNull().default("UPCOMING"),
    freezeDays: integer("freeze_days").notNull().default(3),
    notes: text("notes"),
    endedAt: ts("ended_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("seasons_status_idx").on(t.status),
    index("seasons_end_idx").on(t.endAt),
    // Hanya boleh ada satu season berstatus ACTIVE (diperkuat di level database).
    uniqueIndex("seasons_one_active_uq")
      .on(sql`(status)`)
      .where(sql`status = 'ACTIVE'`),
  ],
);

export const entitlements = pgTable(
  "entitlements",
  {
    id: text("id").primaryKey(),
    uuid: text("uuid").notNull(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    seasonId: text("season_id")
      .notNull()
      .references(() => seasons.id),
    orderId: text("order_id").references(() => orders.id, { onDelete: "set null" }),
    source: entitlementSourceEnum("source").notNull().default("PURCHASE"),
    active: boolean("active").notNull().default(true),
    revokedAt: ts("revoked_at"),
    grantedById: text("granted_by_id").references(() => users.id, { onDelete: "set null" }),
    reason: text("reason"),
    playerName: text("player_name"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("entitlements_uq").on(t.uuid, t.productId, t.seasonId),
    index("entitlements_player_season_idx").on(t.uuid, t.seasonId),
    index("entitlements_season_active_idx").on(t.seasonId, t.active),
  ],
);

export const carts = pgTable(
  "carts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    guestKey: text("guest_key").unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("carts_user_idx").on(t.userId)],
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: text("id").primaryKey(),
    cartId: text("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    targetUuid: text("target_uuid"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("cart_items_uq").on(t.cartId, t.productId)],
);

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    orderNumber: text("order_number").notNull().unique(),
    publicToken: text("public_token").notNull().unique(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    mcUuid: text("mc_uuid").notNull(),
    mcName: text("mc_name").notNull(),
    edition: editionEnum("edition").notNull().default("JAVA"),
    seasonId: text("season_id")
      .notNull()
      .references(() => seasons.id),
    status: orderStatusEnum("status").notNull().default("PENDING"),
    subtotalIdr: integer("subtotal_idr").notNull(),
    discountIdr: integer("discount_idr").notNull().default(0),
    taxIdr: integer("tax_idr").notNull().default(0),
    feeIdr: integer("fee_idr").notNull().default(0),
    totalIdr: integer("total_idr").notNull(),
    couponCode: text("coupon_code"),
    provider: paymentProviderEnum("provider"),
    paymentRef: text("payment_ref"),
    customerNote: text("customer_note"),
    adminNote: text("admin_note"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    expiresAt: ts("expires_at").notNull(),
    paidAt: ts("paid_at"),
    deliveredAt: ts("delivered_at"),
    cancelledAt: ts("cancelled_at"),
  },
  (t) => [
    index("orders_status_created_idx").on(t.status, t.createdAt),
    index("orders_email_idx").on(sql`lower(${t.email})`),
    index("orders_mc_uuid_idx").on(t.mcUuid),
    index("orders_user_idx").on(t.userId),
    index("orders_season_idx").on(t.seasonId),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    type: productTypeEnum("type").notNull(),
    nameSnapshot: text("name_snapshot").notNull(),
    unitPriceIdr: integer("unit_price_idr").notNull(),
    quantity: integer("quantity").notNull().default(1),
    lineTotalIdr: integer("line_total_idr").notNull(),
    targetUuid: text("target_uuid").notNull(),
    targetName: text("target_name").notNull(),
    meta: jsonb("meta").$type<{ upgradeFromProductId?: string; upgradeFromName?: string }>(),
    createdAt: createdAt(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), index("order_items_product_idx").on(t.productId)],
);

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: paymentProviderEnum("provider").notNull(),
    providerRef: text("provider_ref").notNull().unique(),
    method: text("method"),
    status: paymentStatusEnum("status").notNull().default("PENDING"),
    amountIdr: integer("amount_idr").notNull(),
    feeIdr: integer("fee_idr").notNull().default(0),
    checkoutUrl: text("checkout_url"),
    payCode: text("pay_code"),
    expiresAt: ts("expires_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    paidAt: ts("paid_at"),
    rawCreate: jsonb("raw_create").$type<Record<string, unknown>>(),
  },
  (t) => [index("payments_order_idx").on(t.orderId), index("payments_status_idx").on(t.status)],
);

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id").references(() => orders.id, { onDelete: "set null" }),
    provider: paymentProviderEnum("provider").notNull(),
    eventType: text("event_type").notNull(),
    signatureValid: boolean("signature_valid").notNull(),
    dedupeKey: text("dedupe_key").notNull().unique(),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>().notNull(),
    headers: jsonb("headers").$type<Record<string, string>>(),
    ip: text("ip"),
    receivedAt: ts("received_at").notNull().defaultNow(),
    processedAt: ts("processed_at"),
    result: text("result"),
  },
  (t) => [index("payment_events_order_idx").on(t.orderId), index("payment_events_received_idx").on(t.receivedAt)],
);

export const deliveries = pgTable(
  "deliveries",
  {
    id: text("id").primaryKey(),
    // Nullable: perintah pencabutan saat transisi season tidak terikat order.
    orderId: text("order_id").references(() => orders.id, { onDelete: "cascade" }),
    orderItemId: text("order_item_id").references(() => orderItems.id, { onDelete: "set null" }),
    seasonId: text("season_id").references(() => seasons.id, { onDelete: "set null" }),
    uuid: text("uuid").notNull(),
    playerName: text("player_name").notNull(),
    productId: text("product_id").notNull(),
    method: deliveryMethodEnum("method").notNull().default("PLUGIN"),
    status: deliveryStatusEnum("status").notNull().default("QUEUED"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: ts("next_attempt_at").notNull().defaultNow(),
    commands: jsonb("commands").$type<string[]>().notNull(),
    lastError: text("last_error"),
    deliveredAt: ts("delivered_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("deliveries_order_item_uq").on(t.orderItemId),
    index("deliveries_status_next_idx").on(t.status, t.nextAttemptAt),
    index("deliveries_order_idx").on(t.orderId),
    index("deliveries_uuid_idx").on(t.uuid),
  ],
);

export const deliveryAttempts = pgTable(
  "delivery_attempts",
  {
    id: text("id").primaryKey(),
    deliveryId: text("delivery_id")
      .notNull()
      .references(() => deliveries.id, { onDelete: "cascade" }),
    attempt: integer("attempt").notNull(),
    ok: boolean("ok").notNull(),
    output: text("output"),
    error: text("error"),
    durationMs: integer("duration_ms").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("delivery_attempts_delivery_idx").on(t.deliveryId)],
);

export const coupons = pgTable(
  "coupons",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    type: couponTypeEnum("type").notNull(),
    value: integer("value").notNull(),
    minSubtotalIdr: integer("min_subtotal_idr").notNull().default(0),
    maxRedemptions: integer("max_redemptions"),
    maxPerUser: integer("max_per_user").notNull().default(1),
    startsAt: ts("starts_at"),
    endsAt: ts("ends_at"),
    active: boolean("active").notNull().default(true),
    rankOnly: boolean("rank_only").notNull().default(false),
    kitOnly: boolean("kit_only").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("coupons_active_idx").on(t.active)],
);

export const couponRedemptions = pgTable(
  "coupon_redemptions",
  {
    id: text("id").primaryKey(),
    couponId: text("coupon_id")
      .notNull()
      .references(() => coupons.id, { onDelete: "cascade" }),
    orderId: text("order_id")
      .notNull()
      .unique()
      .references(() => orders.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    amountIdr: integer("amount_idr").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("coupon_redemptions_coupon_idx").on(t.couponId), index("coupon_redemptions_email_idx").on(t.email)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorLabel: text("actor_label").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    before: jsonb("before").$type<Record<string, unknown> | null>(),
    after: jsonb("after").$type<Record<string, unknown> | null>(),
    reason: text("reason"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_created_idx").on(t.createdAt),
    index("audit_action_idx").on(t.action),
    index("audit_actor_idx").on(t.actorId),
    index("audit_target_idx").on(t.targetType, t.targetId),
  ],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
  updatedBy: text("updated_by"),
});

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    kind: notificationKindEnum("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    href: text("href"),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt), index("notifications_created_idx").on(t.createdAt)],
);

export const jobs = pgTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: jobStatusEnum("status").notNull().default("PENDING"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    runAt: ts("run_at").notNull().defaultNow(),
    lockedAt: ts("locked_at"),
    lockedBy: text("locked_by"),
    lastError: text("last_error"),
    dedupeKey: text("dedupe_key").unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    finishedAt: ts("finished_at"),
  },
  (t) => [index("jobs_status_run_idx").on(t.status, t.runAt)],
);

export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: text("id").primaryKey(),
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    text: text("text").notNull(),
    provider: text("provider").notNull(),
    status: emailStatusEnum("status").notNull().default("QUEUED"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    sentAt: ts("sent_at"),
    createdAt: createdAt(),
  },
  (t) => [index("email_outbox_status_idx").on(t.status, t.createdAt)],
);

export const pluginNonces = pgTable(
  "plugin_nonces",
  {
    id: text("id").primaryKey(),
    nonce: text("nonce").notNull().unique(),
    createdAt: createdAt(),
  },
  (t) => [index("plugin_nonces_created_idx").on(t.createdAt)],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: text("id").primaryKey(),
    email: text("email"),
    ip: text("ip"),
    success: boolean("success").notNull(),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [
    index("login_attempts_created_idx").on(t.createdAt),
    index("login_attempts_ip_idx").on(t.ip, t.createdAt),
    index("login_attempts_email_idx").on(t.email, t.createdAt),
  ],
);

// Tipe hasil query yang dipakai lintas modul.
export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type KitItem = typeof kitItems.$inferSelect;
export type Season = typeof seasons.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type PaymentEvent = typeof paymentEvents.$inferSelect;
export type Delivery = typeof deliveries.$inferSelect;
export type DeliveryAttempt = typeof deliveryAttempts.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type Entitlement = typeof entitlements.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type MinecraftProfile = typeof minecraftProfiles.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Server = typeof servers.$inferSelect;

/**
 * Kredensial gateway pembayaran. Disimpan terenkripsi (AES-256-GCM) dan hanya
 * bisa diubah oleh Owner. Mode sandbox/live diatur per provider.
 */
export const paymentCredentials = pgTable("payment_credentials", {
  id: text("id").primaryKey(),
  provider: paymentProviderEnum("provider").notNull().unique(),
  mode: text("mode").notNull().default("sandbox"),
  enabled: boolean("enabled").notNull().default(false),
  configEncrypted: text("config_encrypted").notNull(),
  updatedAt: updatedAt(),
  updatedBy: text("updated_by"),
});

export type PaymentCredential = typeof paymentCredentials.$inferSelect;
