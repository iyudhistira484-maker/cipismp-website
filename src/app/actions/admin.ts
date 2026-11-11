"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { commandTemplates, coupons, deliveries, kitItems, orders, products, seasons, servers, sessions, users } from "@/server/db/schema";
import { requireStaff, requirePermissionApi } from "@/server/auth/guard";
import { assertSameOrigin, clientIp } from "@/server/csrf";
import { enforceRateLimit } from "@/server/rate-limit";
import { writeAudit } from "@/server/audit";
import { ids } from "@/server/ids";
import { logger } from "@/server/logger";
import { fulfillPaidOrder, cancelOrder } from "@/server/orders";
import { redeliver } from "@/server/delivery";
import { buildGrantCommands, validateTemplate } from "@/server/delivery/commands";
import { grantEntitlement } from "@/server/entitlements";
import { previewTransition, runSeasonTransition } from "@/server/seasons/transition";
import { enqueue } from "@/server/queue";
import { getSettings, updateSettings } from "@/server/settings";
import { saveProviderConfig, getAvailableProviders, PROVIDER_LABEL, type ProviderId } from "@/server/payments";
import { encryptSecret, decryptSecret } from "@/server/crypto";
import { testPluginEndpoint, testRcon } from "@/server/admin/server-test";
import { parseIdr } from "@/lib/money";
import { fromJakartaInput } from "@/lib/form-datetime";
import type { CouponTier } from "@/lib/pricing";
import { MIDTRANS_METHODS, TRIPAY_METHODS } from "@/lib/payment-methods";
import { STAFF_ROLES, type Role } from "@/server/rbac";
import { PRODUCT_ACCENT_CHOICES, PRODUCT_ARTWORK_CHOICES } from "@/lib/product-artwork";

export interface AdminState {
  error?: string;
  success?: string;
  data?: Record<string, string | number | boolean | null>;
}

async function guard(limit = 20, windowSeconds = 60): Promise<{ ip: string; actor: { id: string; label: string } }> {
  const requestHeaders = await headers();
  assertSameOrigin(new Request("http://internal/action", { method: "POST", headers: requestHeaders }));
  const viewer = await requireStaff();
  const ip = clientIp(requestHeaders);
  await enforceRateLimit(`admin:${viewer.user.id}`, limit, windowSeconds);
  return { ip, actor: { id: viewer.user.id, label: viewer.user.username || viewer.user.email } };
}

function fail(error: unknown): AdminState {
  if (error instanceof Error) return { error: error.message };
  logger.error("admin_action_failed", { error: String(error) });
  return { error: "Terjadi kesalahan. Coba lagi." };
}

function idrField(formData: FormData, name: string): number | null {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) return 0;
  return parseIdr(raw);
}

/* ------------------------------------------------------------------ pesanan */

export async function adminMarkPaidAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { ip, actor } = await guard();
    await requirePermissionApi("orders.write");
    const orderId = String(formData.get("orderId") ?? "");
    const reason = String(formData.get("reason") ?? "").trim();
    if (reason.length < 5) return { error: "Alasan minimal 5 karakter (tercatat di audit log)." };

    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
    if (!order) return { error: "Order tidak ditemukan." };
    if (order.status !== "PENDING" && order.status !== "EXPIRED") {
      return { error: "Hanya order PENDING/EXPIRED yang bisa ditandai lunas manual." };
    }

    const result = await fulfillPaidOrder({
      orderId: order.id,
      paymentId: null,
      amountIdr: order.totalIdr,
      method: "MANUAL",
    });
    await writeAudit({
      actor,
      action: "order.manual-paid",
      targetType: "order",
      targetId: order.id,
      before: { status: order.status },
      after: { status: "PAID", amountIdr: order.totalIdr, deliveriesCreated: result.deliveriesCreated },
      reason,
      ip,
    });
    revalidatePath("/admin/pesanan");
    revalidatePath(`/admin/pesanan/${order.id}`);
    return { success: `Order ${order.orderNumber} ditandai lunas. ${result.deliveriesCreated} pengiriman dibuat.` };
  } catch (error) {
    return fail(error);
  }
}

export async function adminCancelOrderAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { ip, actor } = await guard();
    await requirePermissionApi("orders.write");
    const orderId = String(formData.get("orderId") ?? "");
    const reason = String(formData.get("reason") ?? "").trim();
    if (reason.length < 5) return { error: "Alasan minimal 5 karakter." };

    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
    if (!order) return { error: "Order tidak ditemukan." };
    if (!["PENDING", "EXPIRED"].includes(order.status)) {
      return { error: "Order yang sudah dibayar tidak bisa dibatalkan. Tidak ada refund di toko ini." };
    }
    await db.update(orders).set({ status: "CANCELLED", cancelledAt: new Date(), adminNote: reason, updatedAt: new Date() }).where(eq(orders.id, order.id));
    await writeAudit({
      actor,
      action: "order.cancelled",
      targetType: "order",
      targetId: order.id,
      before: { status: order.status },
      after: { status: "CANCELLED" },
      reason,
      ip,
    });
    revalidatePath("/admin/pesanan");
    return { success: `Order ${order.orderNumber} dibatalkan.` };
  } catch (error) {
    return fail(error);
  }
}

export async function adminSaveOrderNoteAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { ip, actor } = await guard();
    await requirePermissionApi("orders.write");
    const orderId = String(formData.get("orderId") ?? "");
    const note = String(formData.get("adminNote") ?? "").trim().slice(0, 1000);
    await db.update(orders).set({ adminNote: note || null, updatedAt: new Date() }).where(eq(orders.id, orderId));
    await writeAudit({ actor, action: "order.note", targetType: "order", targetId: orderId, after: { adminNote: note }, ip });
    revalidatePath(`/admin/pesanan/${orderId}`);
    return { success: "Catatan admin disimpan." };
  } catch (error) {
    return fail(error);
  }
}

/* ---------------------------------------------------------------- pengiriman */

export async function adminRedeliverAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { ip, actor } = await guard(10, 60);
    await requirePermissionApi("orders.redeliver");
    const deliveryId = String(formData.get("deliveryId") ?? "");
    const delivery = await db.query.deliveries.findFirst({ where: eq(deliveries.id, deliveryId) });
    if (!delivery) return { error: "Pengiriman tidak ditemukan." };

    const outcome = await redeliver(deliveryId);
    await writeAudit({
      actor,
      action: "delivery.redeliver",
      targetType: "delivery",
      targetId: deliveryId,
      before: { status: delivery.status, attempts: delivery.attempts },
      after: { ok: outcome.ok, queuedForNextJoin: outcome.queuedForNextJoin ?? false },
      ip,
    });
    revalidatePath("/admin/pengiriman");
    if (!outcome.ok) return { error: `Pengiriman gagal: ${outcome.error ?? "tidak diketahui"}` };
    return {
      success: outcome.queuedForNextJoin
        ? "Perintah diantrekan plugin sampai pemain login berikutnya."
        : "Pengiriman berhasil dikirim ulang.",
    };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------------------ produk */

const kitItemSchema = z.object({
  itemKey: z.string().regex(/^[a-z0-9_:-]{1,64}$/i, "ID item hanya boleh memakai huruf, angka, titik dua, garis bawah, atau tanda hubung."),
  name: z.string().min(1).max(80),
  quantity: z.number().int().min(1).max(64),
  enchantments: z.array(z.string().min(1).max(80)).max(8),
  lore: z.array(z.string().min(1).max(120)).max(8),
});

function parseKitItems(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const columns = line.split("|").map((column) => column.trim());
      return {
        itemKey: columns[0] ?? "",
        name: columns[1] ?? "",
        quantity: Number(columns[2] ?? 0),
        enchantments: columns[3] ? columns[3].split(",").map((value) => value.trim()).filter(Boolean) : [],
        lore: columns[4] ? columns[4].split(",").map((value) => value.trim()).filter(Boolean) : [],
      };
    });
}

const productSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["RANK", "KIT"]),
  slug: z.string().regex(/^[a-z0-9-]{3,40}$/, "Slug hanya huruf kecil, angka, dan tanda hubung."),
  name: z.string().min(2).max(40),
  tagline: z.string().min(3).max(120),
  description: z.string().min(10).max(2000),
  artwork: z.string().max(160).refine(
    (value) => !value || PRODUCT_ARTWORK_CHOICES.some((choice) => choice.value === value),
    "Pilih ilustrasi lokal yang tersedia.",
  ),
  accent: z.string().refine(
    (value) => PRODUCT_ACCENT_CHOICES.some((choice) => choice.value === value),
    "Pilih warna badge yang tersedia.",
  ),
  priceIdr: z.number().int().min(1000).max(50_000_000),
  tier: z.number().int().min(0).max(20),
  maxPerSeason: z.number().int().min(1).max(50),
  cooldownHours: z.number().int().min(0).max(720),
  sortOrder: z.number().int().min(0).max(999),
  perks: z.array(z.string().min(1).max(80)).max(12),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  useServerCommands: z.boolean(),
  grantTemplate: z.string().max(4000),
  revokeTemplate: z.string().max(4000),
  kitItems: z.array(kitItemSchema).max(32),
});

async function saveProductAutomation(
  productId: string,
  input: {
    type: "RANK" | "KIT";
    grantTemplate: string;
    revokeTemplate: string;
    kitItems: Array<z.infer<typeof kitItemSchema>>;
  },
) {
  await db.transaction(async (tx) => {
    for (const entry of [
      { kind: "GRANT" as const, template: input.grantTemplate.trim() },
      { kind: "REVOKE" as const, template: input.revokeTemplate.trim() },
    ]) {
      if (!entry.template) {
        await tx
          .delete(commandTemplates)
          .where(and(eq(commandTemplates.productId, productId), eq(commandTemplates.kind, entry.kind)));
        continue;
      }
      await tx
        .insert(commandTemplates)
        .values({
          id: ids.product().replace(/^prd/, "cmd"),
          productId,
          kind: entry.kind,
          template: entry.template,
        })
        .onConflictDoUpdate({
          target: [commandTemplates.productId, commandTemplates.kind],
          set: { template: entry.template, updatedAt: new Date() },
        });
    }

    await tx.delete(kitItems).where(eq(kitItems.productId, productId));
    if (input.type === "KIT" && input.kitItems.length > 0) {
      await tx.insert(kitItems).values(
        input.kitItems.map((item, slot) => ({
          id: ids.kitItem(),
          productId,
          slot,
          itemKey: item.itemKey,
          name: item.name,
          quantity: item.quantity,
          enchantments: item.enchantments,
          lore: item.lore,
        })),
      );
    }
  });
}

export async function adminSaveProductAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { ip, actor } = await guard();
    await requirePermissionApi("products.write");
    const price = idrField(formData, "priceIdr");
    if (price === null) return { error: "Harga harus angka rupiah yang valid." };
    const kitItemsRaw = String(formData.get("kitItems") ?? "");
    const kitItemLines = kitItemsRaw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (kitItemLines.some((line) => line.split("|").length !== 5)) {
      return { error: "Setiap baris isi kit harus memiliki 5 kolom yang dipisahkan tanda |." };
    }

    const parsed = productSchema.safeParse({
      id: String(formData.get("id") ?? "") || undefined,
      type: String(formData.get("type") ?? "RANK"),
      slug: String(formData.get("slug") ?? "").trim().toLowerCase(),
      name: String(formData.get("name") ?? "").trim(),
      tagline: String(formData.get("tagline") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
      artwork: String(formData.get("artwork") ?? ""),
      accent: String(formData.get("accent") ?? "amber"),
      priceIdr: price,
      tier: Number(formData.get("tier") ?? 0),
      maxPerSeason: Number(formData.get("maxPerSeason") ?? 1),
      cooldownHours: Number(formData.get("cooldownHours") ?? 0),
      sortOrder: Number(formData.get("sortOrder") ?? 0),
      perks: String(formData.get("perks") ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      status: String(formData.get("status") ?? "DRAFT"),
      useServerCommands: formData.has("useServerCommands"),
      grantTemplate: String(formData.get("grantTemplate") ?? "").trim(),
      revokeTemplate: String(formData.get("revokeTemplate") ?? "").trim(),
      kitItems: parseKitItems(kitItemsRaw),
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data produk tidak valid." };
    const data = parsed.data;
    for (const [label, template] of [["grant", data.grantTemplate], ["revoke", data.revokeTemplate]] as const) {
      const validation = validateTemplate(template);
      if (!validation.ok) return { error: `Template ${label}: ${validation.error}` };
    }
    const hasGrantCommand = data.grantTemplate
      .split(/\r?\n/)
      .some((line) => line.trim().length > 0 && !line.trim().startsWith("#"));
    if (data.status === "PUBLISHED" && data.useServerCommands && !hasGrantCommand) {
      return { error: "Produk tayang yang mengirim perintah harus punya minimal satu baris grant (bukan komentar)." };
    }
    if (data.type === "KIT" && data.status === "PUBLISHED" && data.kitItems.length === 0) {
      return { error: "Kit tayang harus berisi minimal satu item." };
    }

    if (data.id) {
      const existing = await db.query.products.findFirst({ where: eq(products.id, data.id) });
      if (!existing) return { error: "Produk tidak ditemukan." };
      await db
        .update(products)
        .set({
          type: data.type,
          slug: data.slug,
          name: data.name,
          tagline: data.tagline,
          description: data.description,
          artwork: data.artwork || null,
          accent: data.accent,
          priceIdr: data.priceIdr,
          tier: data.tier,
          maxPerSeason: data.maxPerSeason,
          cooldownHours: data.cooldownHours,
          sortOrder: data.sortOrder,
          perks: data.perks,
          status: data.status,
          useServerCommands: data.useServerCommands,
          updatedAt: new Date(),
        })
        .where(eq(products.id, data.id));
      await saveProductAutomation(data.id, data);
      await writeAudit({
        actor,
        action: "product.updated",
        targetType: "product",
        targetId: data.id,
        before: {
          name: existing.name,
          slug: existing.slug,
          type: existing.type,
          priceIdr: existing.priceIdr,
          tier: existing.tier,
          status: existing.status,
          sortOrder: existing.sortOrder,
          accent: existing.accent,
          artwork: existing.artwork,
          perks: existing.perks,
          useServerCommands: existing.useServerCommands,
        },
        after: {
          name: data.name,
          slug: data.slug,
          type: data.type,
          priceIdr: data.priceIdr,
          tier: data.tier,
          status: data.status,
          sortOrder: data.sortOrder,
          accent: data.accent,
          artwork: data.artwork || null,
          perks: data.perks,
          useServerCommands: data.useServerCommands,
          kitItemCount: data.kitItems.length,
        },
        ip,
      });
      revalidatePath("/admin/produk");
      revalidatePath("/");
      revalidatePath("/rank");
      revalidatePath("/kit");
      revalidatePath(`/rank/${existing.slug}`);
      revalidatePath(`/kit/${existing.slug}`);
      revalidatePath(`/rank/${data.slug}`);
      revalidatePath(`/kit/${data.slug}`);
      return { success: `Produk ${data.name} diperbarui.` };
    }

    const newId = ids.product();
    await db.insert(products).values({
      id: newId,
      slug: data.slug,
      type: data.type,
      name: data.name,
      tagline: data.tagline,
      description: data.description,
      artwork: data.artwork || null,
      accent: data.accent,
      priceIdr: data.priceIdr,
      tier: data.tier,
      maxPerSeason: data.maxPerSeason,
      cooldownHours: data.cooldownHours,
      sortOrder: data.sortOrder,
      perks: data.perks,
      status: data.status,
      useServerCommands: data.useServerCommands,
    });
    await saveProductAutomation(newId, data);
    await writeAudit({
      actor,
      action: "product.created",
      targetType: "product",
      targetId: newId,
      after: {
        name: data.name,
        slug: data.slug,
        type: data.type,
        priceIdr: data.priceIdr,
        tier: data.tier,
        status: data.status,
        accent: data.accent,
        artwork: data.artwork || null,
        perks: data.perks,
        useServerCommands: data.useServerCommands,
        kitItemCount: data.kitItems.length,
      },
      ip,
    });
    revalidatePath("/admin/produk");
    revalidatePath("/");
    revalidatePath("/rank");
    revalidatePath("/kit");
    return { success: `Produk ${data.name} dibuat.` };
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) {
      return { error: "Slug produk sudah dipakai." };
    }
    return fail(error);
  }
}

export async function adminDeleteProductAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { ip, actor } = await guard();
    await requirePermissionApi("products.write");
    const productId = String(formData.get("productId") ?? "");
    const product = await db.query.products.findFirst({ where: eq(products.id, productId) });
    if (!product) return { error: "Produk tidak ditemukan." };
    await db
      .update(products)
      .set({ deletedAt: new Date(), status: "DRAFT", updatedAt: new Date() })
      .where(eq(products.id, productId));
    await writeAudit({ actor, action: "product.deleted", targetType: "product", targetId: productId, before: { name: product.name }, ip });
    revalidatePath("/admin/produk");
    revalidatePath("/");
    revalidatePath("/rank");
    revalidatePath("/kit");
    revalidatePath(`/rank/${product.slug}`);
    revalidatePath(`/kit/${product.slug}`);
    return { success: `Produk ${product.name} disembunyikan (soft delete). Riwayat order tetap utuh.` };
  } catch (error) {
    return fail(error);
  }
}

export async function adminRestoreProductAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { ip, actor } = await guard();
    await requirePermissionApi("products.write");
    const productId = String(formData.get("productId") ?? "");
    const product = await db.query.products.findFirst({ where: eq(products.id, productId) });
    if (!product) return { error: "Produk tidak ditemukan." };
    if (!product.deletedAt) return { error: "Produk ini tidak sedang dihapus." };

    await db
      .update(products)
      .set({ deletedAt: null, status: "DRAFT", updatedAt: new Date() })
      .where(eq(products.id, productId));
    await writeAudit({
      actor,
      action: "product.restored",
      targetType: "product",
      targetId: productId,
      before: { name: product.name, deletedAt: product.deletedAt },
      after: { name: product.name, deletedAt: null, status: "DRAFT" },
      ip,
    });
    revalidatePath("/admin/produk");
    revalidatePath("/");
    revalidatePath("/rank");
    revalidatePath("/kit");
    return { success: `Produk ${product.name} dipulihkan sebagai Draft.` };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------------------ season */

export async function adminSaveSeasonAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { ip, actor } = await guard();
    await requirePermissionApi("seasons.write");
    const parsed = z
      .object({
        id: z.string().optional(),
        name: z.string().min(3).max(60),
        slug: z.string().regex(/^[a-z0-9-]{3,40}$/, "Slug tidak valid."),
        startAt: z.coerce.date(),
        endAt: z.coerce.date(),
        freezeDays: z.number().int().min(0).max(30),
        status: z.enum(["UPCOMING", "ACTIVE", "ENDED"]),
        notes: z.string().max(1000).optional(),
      })
      .refine((d) => d.endAt.getTime() > d.startAt.getTime(), { message: "Tanggal selesai harus setelah mulai." })
      .safeParse({
        id: String(formData.get("id") ?? "") || undefined,
        name: String(formData.get("name") ?? "").trim(),
        slug: String(formData.get("slug") ?? "").trim().toLowerCase(),
        startAt: String(formData.get("startAt") ?? ""),
        endAt: String(formData.get("endAt") ?? ""),
        freezeDays: Number(formData.get("freezeDays") ?? 3),
        status: String(formData.get("status") ?? "UPCOMING"),
        notes: String(formData.get("notes") ?? "").trim() || undefined,
      });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data season tidak valid." };
    const data = parsed.data;

    if (data.status === "ACTIVE") {
      const other = await db.query.seasons.findFirst({ where: eq(seasons.status, "ACTIVE") });
      if (other && other.id !== data.id) {
        return { error: `Season ${other.name} masih aktif. Akhiri dulu sebelum mengaktifkan season lain.` };
      }
    }

    if (data.id) {
      const existing = await db.query.seasons.findFirst({ where: eq(seasons.id, data.id) });
      if (!existing) return { error: "Season tidak ditemukan." };
      await db
        .update(seasons)
        .set({
          name: data.name,
          slug: data.slug,
          startAt: data.startAt,
          endAt: data.endAt,
          freezeDays: data.freezeDays,
          status: data.status,
          notes: data.notes ?? null,
          updatedAt: new Date(),
        })
        .where(eq(seasons.id, data.id));
      await writeAudit({
        actor,
        action: "season.updated",
        targetType: "season",
        targetId: data.id,
        before: { name: existing.name, endAt: existing.endAt, status: existing.status },
        after: { name: data.name, endAt: data.endAt, status: data.status },
        ip,
      });
      revalidatePath("/admin/season");
      revalidatePath("/");
      return { success: `Season ${data.name} diperbarui.` };
    }

    const newId = ids.season();
    await db.insert(seasons).values({
      id: newId,
      name: data.name,
      slug: data.slug,
      startAt: data.startAt,
      endAt: data.endAt,
      freezeDays: data.freezeDays,
      status: data.status,
      notes: data.notes ?? null,
    });
    await writeAudit({ actor, action: "season.created", targetType: "season", targetId: newId, after: { ...data }, ip });
    revalidatePath("/admin/season");
    return { success: `Season ${data.name} dibuat.` };
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) {
      return { error: "Slug season sudah dipakai atau sudah ada season aktif lain." };
    }
    return fail(error);
  }
}

export async function adminPreviewTransitionAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    await requirePermissionApi("seasons.write");
    const seasonId = String(formData.get("seasonId") ?? "");
    const preview = await previewTransition(seasonId);
    if (!preview) return { error: "Season tidak ditemukan." };
    return {
      data: {
        season: preview.season.name,
        activeEntitlements: preview.activeEntitlements,
        players: preview.affectedPlayers,
        nextSeason: preview.nextSeason?.name ?? null,
        canTransition: preview.canTransition,
        reason: preview.reason,
      },
    };
  } catch (error) {
    return fail(error);
  }
}

export async function adminRunTransitionAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { ip, actor } = await guard(4, 300);
    await requirePermissionApi("seasons.write");
    const seasonId = String(formData.get("seasonId") ?? "");
    const mode = String(formData.get("mode") ?? "dry-run");
    const reason = String(formData.get("reason") ?? "").trim();
    if (mode === "run" && String(formData.get("confirm") ?? "").trim() !== "AKHIRI SEASON") {
      return { error: 'Ketik "AKHIRI SEASON" untuk menjalankan transisi sungguhan.' };
    }
    if (reason.length < 5) return { error: "Alasan minimal 5 karakter." };

    const result = await runSeasonTransition({ seasonId, dryRun: mode !== "run", actor, reason });
    if (!result.dryRun) {
      await writeAudit({ actor, action: "season.transition", targetType: "season", targetId: seasonId, after: { ...result }, reason, ip });
      revalidatePath("/admin/season");
      revalidatePath("/");
      revalidatePath("/rank");
      revalidatePath("/kit");
    }
    return {
      success: result.dryRun
        ? `Simulasi: ${result.entitlementsExpired} entitlement akan dicabut, ${result.playersAffected} pemain terdampak, season berikutnya ${result.activatedSeasonId ?? "belum ada"}.`
        : `Season diakhiri. ${result.entitlementsExpired} entitlement dicabut, ${result.revokeDeliveries} perintah pencabutan diantrekan.`,
      data: { ...result },
    };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------------------ kupon */

export async function adminSaveCouponAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { ip, actor } = await guard();
    await requirePermissionApi("coupons.write");

    const value = idrField(formData, "value");
    const minSubtotalIdr = idrField(formData, "minSubtotalIdr");
    if (value === null || minSubtotalIdr === null) return { error: "Nilai kupon tidak valid." };
    const typeRaw = String(formData.get("type") ?? "PERCENT");
    if (typeRaw !== "PERCENT" && typeRaw !== "FIXED") return { error: "Tipe diskon tidak valid." };
    const type = typeRaw as "PERCENT" | "FIXED";
    if (type === "PERCENT" && (value < 1 || value > 100)) return { error: "Diskon persen harus 1–100." };
    if (type === "FIXED" && value < 1000) return { error: "Diskon nominal minimal Rp 1.000." };

    const tiers: CouponTier[] = [];
    let previousThreshold = minSubtotalIdr;
    for (const tierNumber of [2, 3]) {
      const minimumRaw = String(formData.get(`tier${tierNumber}MinSubtotalIdr`) ?? "").trim();
      const valueRaw = String(formData.get(`tier${tierNumber}Value`) ?? "").trim();
      const tierTypeRaw = String(formData.get(`tier${tierNumber}Type`) ?? "PERCENT");
      if (!minimumRaw && !valueRaw) continue;
      if (!minimumRaw || !valueRaw) return { error: `Minimum dan diskon tingkat ${tierNumber} harus diisi bersama.` };

      const tierMin = parseIdr(minimumRaw);
      const tierValue = parseIdr(valueRaw);
      if (
        tierMin === null ||
        tierValue === null ||
        !Number.isSafeInteger(tierMin) ||
        !Number.isSafeInteger(tierValue) ||
        tierMin > 1_000_000_000
      ) {
        return { error: `Nilai tingkat ${tierNumber} tidak valid.` };
      }
      if (tierTypeRaw !== "PERCENT" && tierTypeRaw !== "FIXED") return { error: `Tipe tingkat ${tierNumber} tidak valid.` };
      const tierType = tierTypeRaw as CouponTier["type"];
      if (tierMin <= previousThreshold) return { error: "Minimum belanja tiap tingkat harus naik secara berurutan." };
      if (tierType === "PERCENT" && (tierValue < 1 || tierValue > 100)) {
        return { error: `Diskon persen tingkat ${tierNumber} harus 1–100.` };
      }
      if (tierType === "FIXED" && tierValue < 1000) return { error: `Diskon nominal tingkat ${tierNumber} minimal Rp 1.000.` };
      tiers.push({ minSubtotalIdr: tierMin, type: tierType, value: tierValue });
      previousThreshold = tierMin;
    }

    const parsed = z
      .object({
        id: z.string().optional(),
        code: z.string().regex(/^[A-Z0-9-]{3,24}$/, "Kode 3–24 karakter huruf besar/angka."),
        minSubtotalIdr: z.number().int().min(0).max(1_000_000_000),
        maxRedemptions: z.number().int().min(0).max(100000),
        maxPerUser: z.number().int().min(0).max(100),
        startsAt: z.string().optional(),
        endsAt: z.string().optional(),
        seasonId: z.string().optional(),
        rankOnly: z.boolean(),
        kitOnly: z.boolean(),
        active: z.boolean(),
      })
      .refine((d) => !(d.rankOnly && d.kitOnly), { message: "Kupon tidak bisa hanya-rank sekaligus hanya-kit." })
      .safeParse({
        id: String(formData.get("id") ?? "") || undefined,
        code: String(formData.get("code") ?? "").trim().toUpperCase(),
        minSubtotalIdr,
        maxRedemptions: Number(formData.get("maxRedemptions") ?? 0),
        maxPerUser: Number(formData.get("maxPerUser") ?? 1),
        startsAt: String(formData.get("startsAt") ?? "").trim() || undefined,
        endsAt: String(formData.get("endsAt") ?? "").trim() || undefined,
        seasonId: String(formData.get("seasonId") ?? "").trim() || undefined,
        rankOnly: formData.get("rankOnly") === "on",
        kitOnly: formData.get("kitOnly") === "on",
        active: formData.get("active") !== null,
      });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data kupon tidak valid." };
    const data = parsed.data;
    const startsAt = data.startsAt ? fromJakartaInput(data.startsAt) : null;
    const endsAt = data.endsAt ? fromJakartaInput(data.endsAt) : null;
    if ((startsAt && !Number.isFinite(startsAt.getTime())) || (endsAt && !Number.isFinite(endsAt.getTime()))) {
      return { error: "Tanggal kupon tidak valid." };
    }
    if (startsAt && endsAt && endsAt <= startsAt) return { error: "Tanggal berakhir harus setelah tanggal mulai." };
    if (data.seasonId) {
      const season = await db.query.seasons.findFirst({ where: eq(seasons.id, data.seasonId) });
      if (!season) return { error: "Season kupon tidak ditemukan." };
    }

    const values = {
      code: data.code,
      type,
      value,
      minSubtotalIdr: data.minSubtotalIdr,
      tiers,
      seasonId: data.seasonId ?? null,
      maxRedemptions: data.maxRedemptions > 0 ? data.maxRedemptions : null,
      maxPerUser: data.maxPerUser,
      startsAt,
      endsAt,
      rankOnly: data.rankOnly,
      kitOnly: data.kitOnly,
      active: data.active,
    };

    if (data.id) {
      await db.update(coupons).set({ ...values, updatedAt: new Date() }).where(eq(coupons.id, data.id));
      await writeAudit({ actor, action: "coupon.updated", targetType: "coupon", targetId: data.id, after: values, ip });
    } else {
      const newId = ids.coupon();
      await db.insert(coupons).values({ id: newId, ...values });
      await writeAudit({ actor, action: "coupon.created", targetType: "coupon", targetId: newId, after: values, ip });
    }
    revalidatePath("/admin/kupon");
    return { success: `Kupon ${data.code} disimpan.` };
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) return { error: "Kode kupon sudah dipakai." };
    return fail(error);
  }
}

export async function adminToggleCouponAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { ip, actor } = await guard();
    await requirePermissionApi("coupons.write");
    const couponId = String(formData.get("couponId") ?? "");
    const coupon = await db.query.coupons.findFirst({ where: eq(coupons.id, couponId) });
    if (!coupon) return { error: "Kupon tidak ditemukan." };
    await db.update(coupons).set({ active: !coupon.active, updatedAt: new Date() }).where(eq(coupons.id, couponId));
    await writeAudit({
      actor,
      action: "coupon.toggled",
      targetType: "coupon",
      targetId: couponId,
      before: { active: coupon.active },
      after: { active: !coupon.active },
      ip,
    });
    revalidatePath("/admin/kupon");
    return { success: `Kupon ${coupon.code} ${coupon.active ? "dinonaktifkan" : "diaktifkan"}.` };
  } catch (error) {
    return fail(error);
  }
}

/* --------------------------------------------------------------- pengaturan */

export async function adminSaveStoreSettingsAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { ip, actor } = await guard();
    await requirePermissionApi("settings.write");
    const taxPercent = Number(formData.get("taxPercent") ?? 0);
    const feeFlatIdr = idrField(formData, "feeFlatIdr");
    const orderExpiryMinutes = Number(formData.get("orderExpiryMinutes") ?? 30);
    const minimumAge = Number(formData.get("minimumAge") ?? 13);
    if (!Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 30) return { error: "PPN harus 0–30%." };
    if (feeFlatIdr === null) return { error: "Biaya tetap tidak valid." };
    if (!Number.isFinite(orderExpiryMinutes) || orderExpiryMinutes < 5 || orderExpiryMinutes > 1440) {
      return { error: "Batas bayar harus 5–1440 menit." };
    }
    if (!Number.isFinite(minimumAge) || minimumAge < 13 || minimumAge > 21) {
      return { error: "Usia minimum 13–21 tahun (kebijakan platform pembayaran)." };
    }

    const patch = {
      store: {
        taxPercent,
        taxLabel: String(formData.get("taxLabel") ?? "PPN").slice(0, 20),
        feeMode: (String(formData.get("feeMode") ?? "absorb") === "pass" ? "pass" : "absorb") as "absorb" | "pass",
        feeFlatIdr,
        feePercent: Math.max(0, Math.min(10, Number(formData.get("feePercent") ?? 0))),
        orderExpiryMinutes,
        checkoutEnabled: formData.get("checkoutEnabled") !== null,
        minimumAge,
        defaultFreezeDays: Math.max(0, Math.min(30, Number(formData.get("defaultFreezeDays") ?? 3))),
      },
      payments: {
        defaultProvider: String(formData.get("defaultProvider") ?? "FAKE") as "TRIPAY" | "MIDTRANS" | "FAKE",
      },
      features: {
        coupons: formData.get("featureCoupons") !== null,
        gifting: formData.get("featureGifting") !== null,
        reviews: formData.get("featureReviews") !== null,
        discordLogin: formData.get("featureDiscord") !== null,
      },
    };
    const before = await getSettings();
    await updateSettings(patch, actor.id);
    await writeAudit({
      actor,
      action: "settings.store",
      targetType: "settings",
      before: { store: before.store, defaultProvider: before.payments.defaultProvider },
      after: patch,
      ip,
    });
    revalidatePath("/admin/pengaturan");
    revalidatePath("/checkout");
    return { success: "Pengaturan toko disimpan." };
  } catch (error) {
    return fail(error);
  }
}

export async function adminSaveSiteSettingsAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { ip, actor } = await guard();
    await requirePermissionApi("settings.write");
    const name = String(formData.get("siteName") ?? "").trim();
    const tagline = String(formData.get("siteTagline") ?? "").trim();
    const supportEmail = String(formData.get("supportEmail") ?? "").trim();
    const discordUrl = String(formData.get("discordUrl") ?? "").trim();
    const announcementRaw = String(formData.get("announcement") ?? "").trim();

    if (name.length < 2 || name.length > 40) return { error: "Nama situs 2–40 karakter." };
    if (tagline.length > 160) return { error: "Tagline maksimal 160 karakter." };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(supportEmail)) return { error: "Email bantuan tidak valid." };
    if (discordUrl && !/^https:\/\//.test(discordUrl)) return { error: "URL Discord harus diawali https://" };
    if (announcementRaw.length > 280) return { error: "Pengumuman maksimal 280 karakter." };

    const patch = {
      site: {
        name,
        tagline,
        supportEmail,
        discordUrl,
        announcement: announcementRaw.length > 0 ? announcementRaw : null,
      },
    };
    const before = await getSettings();
    await updateSettings(patch, actor.id);
    await writeAudit({
      actor,
      action: "settings.site",
      targetType: "settings",
      before: { site: before.site },
      after: patch,
      ip,
    });
    revalidatePath("/admin/pengaturan");
    revalidatePath("/", "layout");
    return { success: "Identitas situs disimpan." };
  } catch (error) {
    return fail(error);
  }
}

export async function adminSaveDeliverySettingsAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { ip, actor } = await guard();
    await requirePermissionApi("settings.write");
    const maxAttempts = Number(formData.get("maxAttempts") ?? 6);
    const baseDelaySeconds = Number(formData.get("baseDelaySeconds") ?? 60);
    const offlineGraceMinutes = Number(formData.get("offlineGraceMinutes") ?? 30);
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) {
      return { error: "Percobaan maksimal 1–20." };
    }
    if (!Number.isInteger(baseDelaySeconds) || baseDelaySeconds < 15 || baseDelaySeconds > 3600) {
      return { error: "Jeda dasar 15–3600 detik." };
    }
    if (!Number.isInteger(offlineGraceMinutes) || offlineGraceMinutes < 0 || offlineGraceMinutes > 1440) {
      return { error: "Masa tunggu offline 0–1440 menit." };
    }

    const patch = { delivery: { maxAttempts, baseDelaySeconds, offlineGraceMinutes } };
    const before = await getSettings();
    await updateSettings(patch, actor.id);
    await writeAudit({
      actor,
      action: "settings.delivery",
      targetType: "settings",
      before: { delivery: before.delivery },
      after: patch,
      ip,
    });
    revalidatePath("/admin/pengaturan");
    return { success: "Pengaturan pengiriman disimpan." };
  } catch (error) {
    return fail(error);
  }
}

function selectedMethodCodes(formData: FormData, field: string, options: readonly { code: string }[]): string[] | null {
  const allowed = new Set(options.map((option) => option.code));
  const values = formData.getAll(field);
  if (values.some((value) => typeof value !== "string" || !allowed.has(value))) return null;
  const selected = new Set(values as string[]);
  return options.filter((option) => selected.has(option.code)).map((option) => option.code);
}

export async function adminSavePaymentMethodsAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { ip, actor } = await guard();
    await requirePermissionApi("settings.write");

    const tripayMethods = selectedMethodCodes(formData, "tripayMethods", TRIPAY_METHODS);
    const midtransMethods = selectedMethodCodes(formData, "midtransMethods", MIDTRANS_METHODS);
    if (tripayMethods === null || midtransMethods === null) {
      return { error: "Daftar metode pembayaran tidak valid. Muat ulang halaman lalu coba lagi." };
    }

    const before = await getSettings();
    const patch = { payments: { tripayMethods, midtransMethods } };
    await updateSettings(patch, actor.id);
    await writeAudit({
      actor,
      action: "payments.methods-saved",
      targetType: "settings",
      targetId: "payments",
      before: {
        tripayMethods: before.payments.tripayMethods,
        midtransMethods: before.payments.midtransMethods,
      },
      after: patch.payments,
      ip,
    });
    revalidatePath("/admin/pembayaran");
    revalidatePath("/admin/pengaturan");
    revalidatePath("/checkout");
    return { success: "Metode pembayaran yang ditawarkan berhasil diperbarui." };
  } catch (error) {
    return fail(error);
  }
}

const PROVIDERS: ProviderId[] = ["TRIPAY", "MIDTRANS", "FAKE"];

export async function adminSaveProviderAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { ip, actor } = await guard();
    await requirePermissionApi("payments.secrets");
    const provider = String(formData.get("provider") ?? "") as ProviderId;
    if (!PROVIDERS.includes(provider)) return { error: "Gateway tidak dikenal." };

    const config: Record<string, string> = {};
    if (provider === "TRIPAY") {
      config.apiKey = String(formData.get("apiKey") ?? "").trim();
      config.privateKey = String(formData.get("privateKey") ?? "").trim();
      config.merchantCode = String(formData.get("merchantCode") ?? "").trim();
      if (!config.apiKey || !config.privateKey || !config.merchantCode) {
        return { error: "API key, private key, dan merchant code Tripay wajib diisi." };
      }
    } else if (provider === "MIDTRANS") {
      config.serverKey = String(formData.get("serverKey") ?? "").trim();
      config.clientKey = String(formData.get("clientKey") ?? "").trim();
      if (!config.serverKey) return { error: "Server key Midtrans wajib diisi." };
    } else {
      config.secret = String(formData.get("secret") ?? "").trim();
      if (config.secret.length < 16) return { error: "Secret simulasi minimal 16 karakter." };
    }

    const mode = String(formData.get("mode") ?? "sandbox") === "live" ? "live" : "sandbox";
    const enabled = formData.get("enabled") !== null;
    const settingsBefore = await getSettings();
    await saveProviderConfig({
      provider,
      config,
      mode,
      enabled,
      updatedBy: actor.id,
    });
    await updateSettings(
      { payments: { enabled: { ...settingsBefore.payments.enabled, [provider]: enabled } } },
      actor.id,
    );
    await writeAudit({
      actor,
      action: "payments.provider-saved",
      targetType: "payment_provider",
      targetId: provider,
      after: { mode, enabled, fields: Object.keys(config) },
      ip,
    });
    revalidatePath("/admin/pembayaran");
    revalidatePath("/admin/pengaturan");
    revalidatePath("/checkout");
    return { success: `Konfigurasi ${PROVIDER_LABEL[provider]} disimpan (${mode}).` };
  } catch (error) {
    return fail(error);
  }
}

export async function adminTestProvidersAction(_prev: AdminState): Promise<AdminState> {
  try {
    await requirePermissionApi("settings.read");
    const available = await getAvailableProviders();
    if (available.length === 0) {
      return { error: "Tidak ada gateway yang siap dipakai. Periksa kredensial dan status aktif." };
    }
    return {
      success: `Gateway siap: ${available.map((p) => `${p.label} (${p.mode}, ${p.methods.length} metode)`).join("; ")}.`,
    };
  } catch (error) {
    return fail(error);
  }
}

export async function adminSaveServerAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { ip, actor } = await guard();
    await requirePermissionApi("settings.write");
    const parsed = z
      .object({
        name: z.string().min(2).max(40),
        javaHost: z.string().min(3).max(120),
        javaPort: z.number().int().min(1).max(65535),
        bedrockHost: z.string().min(3).max(120),
        bedrockPort: z.number().int().min(1).max(65535),
        deliveryMode: z.enum(["PLUGIN", "RCON"]),
        pluginBaseUrl: z.string().url().optional(),
        pluginSecret: z.string().optional(),
        rconHost: z.string().optional(),
        rconPort: z.number().int().min(1).max(65535).optional(),
        rconPassword: z.string().optional(),
        statusApiUrl: z.string().url().optional(),
      })
      .safeParse({
        name: String(formData.get("name") ?? "").trim(),
        javaHost: String(formData.get("javaHost") ?? "").trim(),
        javaPort: Number(formData.get("javaPort") ?? 25565),
        bedrockHost: String(formData.get("bedrockHost") ?? "").trim(),
        bedrockPort: Number(formData.get("bedrockPort") ?? 19202),
        deliveryMode: String(formData.get("deliveryMode") ?? "PLUGIN"),
        pluginBaseUrl: String(formData.get("pluginBaseUrl") ?? "").trim() || undefined,
        pluginSecret: String(formData.get("pluginSecret") ?? "").trim() || undefined,
        rconHost: String(formData.get("rconHost") ?? "").trim() || undefined,
        rconPort: Number(formData.get("rconPort") ?? 0) || undefined,
        rconPassword: String(formData.get("rconPassword") ?? "").trim() || undefined,
        statusApiUrl: String(formData.get("statusApiUrl") ?? "").trim() || undefined,
      });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data server tidak valid." };
    const data = parsed.data;

    const existing = await db.query.servers.findFirst({ where: eq(servers.isDefault, true) });
    const encryptedPluginSecret = data.pluginSecret ? encryptSecret(data.pluginSecret) : existing?.pluginSecret ?? null;
    const encryptedRcon = data.rconPassword ? encryptSecret(data.rconPassword) : existing?.rconPassword ?? null;

    if (existing) {
      await db
        .update(servers)
        .set({
          name: data.name,
          javaHost: data.javaHost,
          javaPort: data.javaPort,
          bedrockHost: data.bedrockHost,
          bedrockPort: data.bedrockPort,
          deliveryMode: data.deliveryMode,
          pluginBaseUrl: data.pluginBaseUrl ?? null,
          pluginSecret: encryptedPluginSecret,
          rconHost: data.rconHost ?? null,
          rconPort: data.rconPort ?? null,
          rconPassword: encryptedRcon,
          statusApiUrl: data.statusApiUrl ?? null,
          updatedAt: new Date(),
        })
        .where(eq(servers.id, existing.id));
    } else {
      await db.insert(servers).values({
        id: ids.nonce(),
        name: data.name,
        isDefault: true,
        javaHost: data.javaHost,
        javaPort: data.javaPort,
        bedrockHost: data.bedrockHost,
        bedrockPort: data.bedrockPort,
        deliveryMode: data.deliveryMode,
        pluginBaseUrl: data.pluginBaseUrl ?? null,
        pluginSecret: encryptedPluginSecret,
        rconHost: data.rconHost ?? null,
        rconPort: data.rconPort ?? null,
        rconPassword: encryptedRcon,
        statusApiUrl: data.statusApiUrl ?? null,
      });
    }
    await writeAudit({
      actor,
      action: "server.saved",
      targetType: "server",
      targetId: existing?.id ?? "new",
      after: {
        name: data.name,
        java: `${data.javaHost}:${data.javaPort}`,
        bedrock: `${data.bedrockHost}:${data.bedrockPort}`,
        deliveryMode: data.deliveryMode,
        pluginBaseUrl: data.pluginBaseUrl ?? null,
        secretRotated: Boolean(data.pluginSecret),
      },
      ip,
    });
    revalidatePath("/admin/server");
    revalidatePath("/");
    return { success: "Pengaturan server disimpan." };
  } catch (error) {
    return fail(error);
  }
}

export async function adminTestServerAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    await requirePermissionApi("settings.read");
    const target = String(formData.get("target") ?? "plugin");
    const row = await db.query.servers.findFirst({ where: eq(servers.isDefault, true) });
    if (!row) return { error: "Belum ada server default. Simpan pengaturan server dulu." };

    if (target === "plugin") {
      if (!row.pluginBaseUrl) return { error: "URL plugin belum diisi." };
      const secret = decryptSecret(row.pluginSecret) ?? process.env.PLUGIN_SHARED_SECRET;
      if (!secret) return { error: "Secret plugin belum diatur." };
      const result = await testPluginEndpoint(row.pluginBaseUrl, secret);
      return result.ok ? { success: result.message } : { error: result.message };
    }

    if (!row.rconHost || !row.rconPort) return { error: "Host/port RCON belum diisi." };
    const result = await testRcon(row.rconHost, row.rconPort, row.rconPassword);
    return result.ok ? { success: result.message } : { error: result.message };
  } catch (error) {
    return fail(error);
  }
}

/* -------------------------------------------------------------------- staf */

export async function adminSetRoleAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { ip, actor } = await guard();
    const viewer = await requirePermissionApi("staff.write");
    const userId = String(formData.get("userId") ?? "");
    const role = String(formData.get("role") ?? "") as Role;
    if (!STAFF_ROLES.includes(role) && role !== "CUSTOMER") return { error: "Role tidak dikenal." };
    if (userId === viewer.user.id) return { error: "Tidak bisa mengubah role akun sendiri." };

    const target = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!target) return { error: "Pengguna tidak ditemukan." };
    if (target.role === "OWNER" && viewer.user.role !== "OWNER") {
      return { error: "Hanya Owner yang bisa mengubah akun Owner." };
    }
    if (role === "OWNER") return { error: "Hanya boleh ada satu Owner; gunakan CLI seed-owner untuk mengganti." };

    await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
    await writeAudit({
      actor,
      action: "staff.role-changed",
      targetType: "user",
      targetId: userId,
      before: { role: target.role },
      after: { role },
      ip,
    });
    revalidatePath("/admin/staf");
    return { success: `Role ${target.email} diubah menjadi ${role}.` };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------------------ sesi staf */

export async function adminRevokeSessionAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { ip, actor } = await guard();
    const viewer = await requirePermissionApi("staff.write");
    const sessionId = String(formData.get("sessionId") ?? "");
    if (!sessionId) return { error: "Sesi tidak dikenal." };

    const { revokeSession } = await import("@/server/auth/session");
    const session = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
    if (!session) return { error: "Sesi tidak ditemukan." };
    if (session.userId === viewer.user.id) {
      return { error: "Tidak bisa mencabut sesi yang sedang kamu pakai. Gunakan logout." };
    }

    await revokeSession(sessionId);
    await writeAudit({
      actor,
      action: "staff.session-revoked",
      targetType: "session",
      targetId: sessionId,
      before: { userId: session.userId, ip: session.ip },
      ip,
    });
    revalidatePath("/admin/staf");
    return { success: "Sesi staf dicabut. Perangkat tersebut harus login ulang + 2FA." };
  } catch (error) {
    return fail(error);
  }
}

export async function adminRevokeAllStaffSessionsAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { ip, actor } = await guard(6, 300);
    const viewer = await requirePermissionApi("staff.write");
    const userId = String(formData.get("userId") ?? "");
    if (!userId) return { error: "Pengguna tidak dikenal." };
    if (userId === viewer.user.id) {
      return { error: "Untuk akun sendiri, gunakan tombol di dashboard (semua sesi lain)." };
    }
    const target = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!target) return { error: "Pengguna tidak ditemukan." };
    if (target.role === "OWNER") return { error: "Sesi Owner hanya bisa dicabut oleh Owner sendiri." };

    const { revokeAllSessions } = await import("@/server/auth/session");
    await revokeAllSessions(userId);
    await writeAudit({
      actor,
      action: "staff.sessions-revoked-all",
      targetType: "user",
      targetId: userId,
      after: { email: target.email, role: target.role },
      ip,
    });
    revalidatePath("/admin/staf");
    return { success: `Semua sesi ${target.email} dicabut.` };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------------------- comp */

export async function adminGrantCompAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { ip, actor } = await guard(10, 300);
    await requirePermissionApi("grants.write");
    const parsed = z
      .object({
        productId: z.string().min(1),
        uuid: z.string().uuid("UUID pemain tidak valid."),
        playerName: z.string().min(3).max(16),
        reason: z.string().min(10, "Alasan comp minimal 10 karakter."),
      })
      .safeParse({
        productId: String(formData.get("productId") ?? ""),
        uuid: String(formData.get("uuid") ?? "").trim(),
        playerName: String(formData.get("playerName") ?? "").trim(),
        reason: String(formData.get("reason") ?? "").trim(),
      });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data comp tidak valid." };

    const product = await db.query.products.findFirst({ where: eq(products.id, parsed.data.productId) });
    if (!product) return { error: "Produk tidak ditemukan." };
    const season = await db.query.seasons.findFirst({ where: eq(seasons.status, "ACTIVE") });
    if (!season) return { error: "Tidak ada season aktif." };

    const grant = await grantEntitlement({
      uuid: parsed.data.uuid,
      playerName: parsed.data.playerName,
      productId: product.id,
      seasonId: season.id,
      source: "COMP",
      grantedById: actor.id,
      reason: parsed.data.reason,
    });

    const commands = await buildGrantCommands({
      productId: product.id,
      uuid: parsed.data.uuid,
      player: parsed.data.playerName,
      seasonSlug: season.slug,
    });
    let deliveryId: string | null = null;
    if (commands.length > 0) {
      deliveryId = ids.delivery();
      await db.insert(deliveries).values({
        id: deliveryId,
        orderId: null,
        seasonId: season.id,
        uuid: parsed.data.uuid,
        playerName: parsed.data.playerName,
        productId: product.id,
        status: "QUEUED",
        commands,
      });
      await enqueue("delivery.process", { deliveryId }, { dedupeKey: `deliver:${deliveryId}` });
    }

    await writeAudit({
      actor,
      action: "entitlement.comp",
      targetType: "entitlement",
      targetId: grant.entitlementId,
      after: {
        uuid: parsed.data.uuid,
        playerName: parsed.data.playerName,
        product: product.name,
        season: season.name,
        replaced: grant.replacedProductIds,
      },
      reason: parsed.data.reason,
      ip,
    });
    revalidatePath("/admin");
    return { success: `${product.name} diberikan ke ${parsed.data.playerName}. ${commands.length} perintah diantrekan.` };
  } catch (error) {
    return fail(error);
  }
}

export async function adminRevokeEntitlementAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { ip, actor } = await guard();
    await requirePermissionApi("grants.write");
    const entitlementId = String(formData.get("entitlementId") ?? "");
    const reason = String(formData.get("reason") ?? "").trim();
    if (reason.length < 5) return { error: "Alasan minimal 5 karakter." };

    const { revokeEntitlement } = await import("@/server/entitlements");
    await revokeEntitlement(entitlementId, reason);
    await writeAudit({
      actor,
      action: "entitlement.revoked",
      targetType: "entitlement",
      targetId: entitlementId,
      reason,
      ip,
    });
    revalidatePath("/admin/pelanggan");
    return { success: "Entitlement dicabut. Jalankan pengiriman ulang bila perintah server perlu dicabut juga." };
  } catch (error) {
    return fail(error);
  }
}

/** Dipakai halaman detail order untuk memastikan order memang ada sebelum render aksi. */
export async function adminOrderExists(orderId: string): Promise<boolean> {
  const rows = await db.select({ id: orders.id }).from(orders).where(eq(orders.id, orderId)).limit(1);
  return rows.length > 0;
}

/** Daftar produk aktif untuk form comp. */
export async function adminActiveProducts(): Promise<Array<{ id: string; name: string; type: string }>> {
  const rows = await db
    .select({ id: products.id, name: products.name, type: products.type })
    .from(products)
    .where(and(inArray(products.status, ["PUBLISHED"])))
    .orderBy(products.type, products.tier);
  return rows;
}
