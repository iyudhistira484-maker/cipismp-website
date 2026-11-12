import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "./db";
import { entitlements, minecraftProfiles, products, seasons } from "./db/schema";
import { ids } from "./ids";
import type { OwnedEntitlement } from "@/lib/pricing";

/** Semua entitlement aktif milik satu UUID pada satu season (termasuk info produk). */
export async function ownedForUuid(uuid: string, seasonId: string): Promise<OwnedEntitlement[]> {
  const rows = await db
    .select({
      productId: products.id,
      productName: products.name,
      productType: products.type,
      tier: products.tier,
      priceIdr: products.priceIdr,
      createdAt: entitlements.createdAt,
      active: entitlements.active,
    })
    .from(entitlements)
    .innerJoin(products, eq(products.id, entitlements.productId))
    .where(and(eq(entitlements.uuid, uuid), eq(entitlements.seasonId, seasonId), eq(entitlements.active, true)));

  return rows.map((row) => ({
    productId: row.productId,
    productName: row.productName,
    productType: row.productType,
    tier: row.tier,
    productPriceIdr: row.priceIdr,
    active: row.active,
    createdAt: row.createdAt,
  }));
}

export async function ownedMap(uuids: string[], seasonId: string): Promise<Map<string, OwnedEntitlement[]>> {
  const map = new Map<string, OwnedEntitlement[]>();
  for (const uuid of uuids) map.set(uuid, await ownedForUuid(uuid, seasonId));
  return map;
}

export interface EntitlementRow {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  productType: "RANK" | "KIT";
  tier: number;
  accent: string;
  seasonId: string;
  seasonName: string;
  seasonEndsAt: Date;
  seasonStatus: "UPCOMING" | "ACTIVE" | "ENDED";
  active: boolean;
  source: "PURCHASE" | "COMP";
  createdAt: Date;
  playerName: string | null;
  uuid: string;
}

/** Entitlement milik seorang user (melalui profil Minecraft yang terhubung). */
export async function entitlementsForUser(userId: string, seasonId?: string): Promise<EntitlementRow[]> {
  const profiles = await db
    .select({ uuid: minecraftProfiles.uuid })
    .from(minecraftProfiles)
    .where(and(eq(minecraftProfiles.userId, userId), isNotNull(minecraftProfiles.verifiedAt)));
  if (profiles.length === 0) return [];
  const rows = await db
    .select({
      id: entitlements.id,
      uuid: entitlements.uuid,
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
      productType: products.type,
      tier: products.tier,
      accent: products.accent,
      seasonId: seasons.id,
      seasonName: seasons.name,
      seasonEndsAt: seasons.endAt,
      seasonStatus: seasons.status,
      active: entitlements.active,
      source: entitlements.source,
      createdAt: entitlements.createdAt,
      playerName: entitlements.playerName,
    })
    .from(entitlements)
    .innerJoin(products, eq(products.id, entitlements.productId))
    .innerJoin(seasons, eq(seasons.id, entitlements.seasonId))
    .where(
      and(
        inArray(
          entitlements.uuid,
          profiles.map((p) => p.uuid),
        ),
        seasonId ? eq(entitlements.seasonId, seasonId) : undefined,
      ),
    )
    .orderBy(entitlements.createdAt);
  return rows;
}

/**
 * Memberikan entitlement. Untuk rank, tier lama otomatis dinonaktifkan karena
 * satu pemain hanya boleh memegang satu rank per season (upgrade = penggantian).
 */
export async function grantEntitlement(input: {
  uuid: string;
  playerName: string;
  productId: string;
  seasonId: string;
  orderId?: string | null;
  source?: "PURCHASE" | "COMP";
  grantedById?: string | null;
  reason?: string | null;
}): Promise<{ entitlementId: string; replacedProductIds: string[] }> {
  const product = await db.select().from(products).where(eq(products.id, input.productId)).limit(1);
  const target = product[0];
  if (!target) throw new Error("Produk tidak ditemukan");

  const replacedProductIds: string[] = [];
  if (target.type === "RANK") {
    const existing = await db.query.entitlements.findMany({
      where: and(
        eq(entitlements.uuid, input.uuid),
        eq(entitlements.seasonId, input.seasonId),
        eq(entitlements.active, true),
      ),
    });
    for (const row of existing) {
      const rowProduct = await db.select().from(products).where(eq(products.id, row.productId)).limit(1);
      if (rowProduct[0]?.type === "RANK" && rowProduct[0].tier <= target.tier) {
        await db
          .update(entitlements)
          .set({ active: false, revokedAt: new Date(), updatedAt: new Date() })
          .where(eq(entitlements.id, row.id));
        replacedProductIds.push(row.productId);
      }
    }
  }

  const existingSame = await db.query.entitlements.findFirst({
    where: and(
      eq(entitlements.uuid, input.uuid),
      eq(entitlements.productId, input.productId),
      eq(entitlements.seasonId, input.seasonId),
    ),
  });

  if (existingSame) {
    await db
      .update(entitlements)
      .set({
        active: true,
        revokedAt: null,
        orderId: input.orderId ?? existingSame.orderId,
        playerName: input.playerName,
        updatedAt: new Date(),
      })
      .where(eq(entitlements.id, existingSame.id));
    return { entitlementId: existingSame.id, replacedProductIds };
  }

  const id = ids.entitlement();
  await db.insert(entitlements).values({
    id,
    uuid: input.uuid,
    productId: input.productId,
    seasonId: input.seasonId,
    orderId: input.orderId ?? null,
    source: input.source ?? "PURCHASE",
    grantedById: input.grantedById ?? null,
    reason: input.reason ?? null,
    playerName: input.playerName,
    active: true,
  });
  return { entitlementId: id, replacedProductIds };
}

export async function revokeEntitlement(id: string, reason: string): Promise<void> {
  await db
    .update(entitlements)
    .set({ active: false, revokedAt: new Date(), reason, updatedAt: new Date() })
    .where(eq(entitlements.id, id));
}
