import { and, asc, desc, eq, inArray, isNull, lte, gte } from "drizzle-orm";
import { db } from "./db";
import { kitItems, products, seasons, type Product, type Season } from "./db/schema";
import type { PriceableProduct } from "@/lib/pricing";
import { sortCipiRanks } from "@/lib/cipi-ranks";

export async function getPublishedProducts(type?: "RANK" | "KIT"): Promise<Product[]> {
  const rows = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.status, "PUBLISHED"),
        isNull(products.deletedAt),
        type ? eq(products.type, type) : undefined,
      ),
    )
    .orderBy(asc(products.type), asc(products.sortOrder), asc(products.name));
  // These four public tiers have a fixed price progression; stale DB sort_order values
  // must not reverse the storefront lineup (including the mixed landing-page catalog).
  if (type === "KIT") return rows;
  const sortedRanks = sortCipiRanks(rows.filter((row) => row.type === "RANK"));
  let rankIndex = 0;
  return rows.map((row) => (row.type === "RANK" ? sortedRanks[rankIndex++]! : row));
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.slug, slug), eq(products.status, "PUBLISHED"), isNull(products.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getProductById(id: string): Promise<Product | null> {
  const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getKitItemsForProducts(productIds: string[]) {
  if (productIds.length === 0) return [];
  return db
    .select()
    .from(kitItems)
    .where(inArray(kitItems.productId, productIds))
    .orderBy(asc(kitItems.productId), asc(kitItems.slot));
}

/** Season ACTIVE saat ini (dijamin maksimal satu oleh unique index parsial). */
export async function getActiveSeason(): Promise<Season | null> {
  const rows = await db.select().from(seasons).where(eq(seasons.status, "ACTIVE")).limit(1);
  return rows[0] ?? null;
}

export async function getSeasonById(id: string): Promise<Season | null> {
  const rows = await db.select().from(seasons).where(eq(seasons.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getNextSeason(now = new Date()): Promise<Season | null> {
  const rows = await db
    .select()
    .from(seasons)
    .where(and(eq(seasons.status, "UPCOMING"), gte(seasons.startAt, now)))
    .orderBy(asc(seasons.startAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function listSeasons(): Promise<Season[]> {
  return db.select().from(seasons).orderBy(desc(seasons.startAt));
}

/** Produk yang bisa dibeli pada season tertentu (belum dihapus & sudah published). */
export async function getPurchasableProducts(): Promise<Product[]> {
  return getPublishedProducts();
}

/** Katalog dalam bentuk map untuk mesin harga. */
export function toPriceable(product: Product): PriceableProduct {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    type: product.type,
    priceIdr: product.priceIdr,
    tier: product.tier,
    maxPerSeason: product.maxPerSeason,
    cooldownHours: product.cooldownHours,
    status: product.status,
    deletedAt: product.deletedAt,
  };
}

export async function getSeasonHistory(limit = 8): Promise<Season[]> {
  return db.select().from(seasons).where(lte(seasons.endAt, new Date())).orderBy(desc(seasons.endAt)).limit(limit);
}
