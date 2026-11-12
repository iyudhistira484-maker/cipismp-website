import { and, eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { commandTemplates, products } from "@/server/db/schema";
import { getPublishedProducts } from "@/server/catalog";
import { databaseUrl } from "./helpers";

const enabled = databaseUrl() !== null;
const expectedRanks = [
  { slug: "cute-cipi", priceIdr: 10_000, tier: 1, group: "vip" },
  { slug: "pop-cipi", priceIdr: 30_000, tier: 2, group: "mvp" },
  { slug: "milk-cipi", priceIdr: 60_000, tier: 3, group: "elite" },
  { slug: "star-cipi", priceIdr: 100_000, tier: 4, group: "legend" },
] as const;

describe.skipIf(!enabled)("katalog rank dan otomatisasi LuckPerms", () => {
  it("menampilkan landing page dan katalog rank dalam urutan Cute, Pop, Milk, Star", async () => {
    const [rankProducts, mixedCatalog] = await Promise.all([
      getPublishedProducts("RANK"),
      getPublishedProducts(),
    ]);
    const expectedSlugs = expectedRanks.map((rank) => rank.slug);
    expect(rankProducts.filter((row) => expectedSlugs.includes(row.slug as (typeof expectedSlugs)[number])).map((row) => row.slug))
      .toEqual(expectedSlugs);
    expect(mixedCatalog.filter((row) => row.type === "RANK" && expectedSlugs.includes(row.slug as (typeof expectedSlugs)[number])).map((row) => row.slug))
      .toEqual(expectedSlugs);
  });

  it("menyimpan harga/tier dan template webhook GRANT/REVOKE sesuai group", async () => {
    const rows = await db
      .select({ slug: products.slug, priceIdr: products.priceIdr, tier: products.tier })
      .from(products)
      .where(and(eq(products.type, "RANK"), inArray(products.slug, expectedRanks.map((rank) => rank.slug))));
    const rowsBySlug = new Map(rows.map((row) => [row.slug, row]));

    for (const rank of expectedRanks) {
      expect(rowsBySlug.get(rank.slug)).toEqual({ slug: rank.slug, priceIdr: rank.priceIdr, tier: rank.tier });
      const [product] = await db.select({ id: products.id }).from(products).where(eq(products.slug, rank.slug)).limit(1);
      expect(product).toBeDefined();
      const templates = await db
        .select({ kind: commandTemplates.kind, template: commandTemplates.template })
        .from(commandTemplates)
        .where(eq(commandTemplates.productId, product!.id));
      expect(templates).toContainEqual({ kind: "GRANT", template: `lp user {uuid} parent add ${rank.group}` });
      expect(templates).toContainEqual({ kind: "REVOKE", template: `lp user {uuid} parent remove ${rank.group}` });
    }
  });
});
