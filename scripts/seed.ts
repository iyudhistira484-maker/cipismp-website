/**
 * Seed data CipiSMP Store — idempoten, aman dijalankan berulang.
 * Melengkapi data default yang belum ada tanpa menimpa perubahan dari dashboard admin.
 * Membuat: pengaturan toko, server, Season 1, 4 rank, 2 kit, template perintah,
 * dan akun Owner dari env (SEED_OWNER_*). Promosi tidak dibuat secara otomatis.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/server/db";
import {
  commandTemplates,
  kitItems,
  products,
  servers,
  seasons,
  settings as settingsTable,
  users,
} from "../src/server/db/schema";
import { ids } from "../src/server/ids";
import { hashPassword } from "../src/server/auth/password";
import { DEFAULT_SETTINGS } from "../src/server/settings";
import { CIPI_KITS } from "../src/lib/cipi-kits";
import { CIPI_RANKS } from "../src/lib/cipi-ranks";

async function seedSettings() {
  await db
    .insert(settingsTable)
    .values({ key: "store.settings", value: DEFAULT_SETTINGS, updatedBy: "seed" })
    .onConflictDoNothing({ target: settingsTable.key });
}

async function seedServer() {
  const existing = await db.query.servers.findFirst({ where: eq(servers.name, "CipiSMP") });
  if (existing) return;
  await db.insert(servers).values({
    id: ids.user().replace("usr", "srv"),
    name: "CipiSMP",
    isDefault: true,
    javaHost: "cipismp.my.id",
    javaPort: 25565,
    bedrockHost: "cipismp.my.id",
    bedrockPort: 19202,
    deliveryMode: "PLUGIN",
    rconHost: "127.0.0.1",
    rconPort: 25575,
  });
}

async function seedSeason(): Promise<string> {
  const existing = await db.query.seasons.findFirst({ where: eq(seasons.slug, "season-1") });
  if (existing) return existing.id;
  const id = ids.season();
  await db.insert(seasons).values({
    id,
    name: "Season 1",
    slug: "season-1",
    startAt: new Date("2026-11-14T00:00:00.000+07:00"),
    endAt: new Date("2027-01-14T00:00:00.000+07:00"),
    status: "ACTIVE",
    freezeDays: 3,
    notes: "Season pembuka CipiSMP. Rank & kit berlaku sampai akhir season.",
  });
  return id;
}

async function seedProducts() {
  for (const rank of CIPI_RANKS) {
    const existing = await db.query.products.findFirst({ where: eq(products.slug, rank.slug) });
    if (existing) continue;

    const productId = ids.product();
    await db.insert(products).values({
      id: productId,
      slug: rank.slug,
      type: "RANK",
      name: rank.name,
      tagline: rank.tagline,
      description: rank.description,
      artwork: rank.artwork,
      priceIdr: rank.priceIdr,
      tier: rank.tier,
      accent: rank.accent,
      status: "PUBLISHED",
      sortOrder: rank.sortOrder,
      perks: [...rank.perks],
      maxPerSeason: 1,
    });
    await upsertCommands(productId, {
      grant: `lp user {uuid} parent add ${rank.groupName}`,
      revoke: `lp user {uuid} parent remove ${rank.groupName}`,
    });
  }

  for (const kit of CIPI_KITS) {
    const existing = await db.query.products.findFirst({ where: eq(products.slug, kit.slug) });
    if (existing) continue;

    const productId = ids.product();
    await db.insert(products).values({
      id: productId,
      slug: kit.slug,
      type: "KIT",
      name: kit.name,
      tagline: kit.tagline,
      description: kit.description,
      artwork: null,
      priceIdr: kit.priceIdr,
      tier: 0,
      accent: "amber",
      status: "PUBLISHED",
      sortOrder: kit.sortOrder,
      perks: [...kit.perks],
      maxPerSeason: kit.maxPerSeason,
      cooldownHours: kit.purchaseCooldownHours,
    });
    await db.insert(kitItems).values(
      kit.items.map((item, index) => ({
        id: ids.kitItem(),
        productId,
        slot: index,
        itemKey: item.itemKey,
        name: item.name,
        quantity: item.quantity,
        enchantments: item.enchantments ? [...item.enchantments] : [],
        lore: item.lore ? [...item.lore] : [],
      })),
    );
    await upsertCommands(productId, {
      grant: `lp user {uuid} permission set ${kit.permissionNode} true`,
      revoke: `lp user {uuid} permission unset ${kit.permissionNode}`,
    });
  }
}

async function upsertCommands(
  productId: string,
  commands: { grant: string; revoke: string; extra?: string },
) {
  const entries: Array<{ kind: "GRANT" | "REVOKE"; template: string }> = [
    { kind: "GRANT", template: commands.extra ? `${commands.grant}\n${commands.extra}` : commands.grant },
    { kind: "REVOKE", template: commands.revoke },
  ];
  for (const entry of entries) {
    await db
      .insert(commandTemplates)
      .values({ id: ids.product().replace("prd", "cmd"), productId, kind: entry.kind, template: entry.template })
      .onConflictDoUpdate({
        target: [commandTemplates.productId, commandTemplates.kind],
        set: { template: entry.template, updatedAt: new Date() },
      });
  }
}

async function seedOwner() {
  const email = process.env.SEED_OWNER_EMAIL;
  const username = process.env.SEED_OWNER_USERNAME;
  const password = process.env.SEED_OWNER_PASSWORD;
  if (!email || !username || !password) {
    console.log("[seed] SEED_OWNER_* tidak lengkap — akun owner dilewati.");
    return;
  }
  const existing = await db.query.users.findFirst({ where: eq(users.email, email.toLowerCase()) });
  if (existing) {
    console.log(`[seed] Owner ${email} sudah ada.`);
    return;
  }
  await db.insert(users).values({
    id: ids.user(),
    email: email.toLowerCase(),
    username,
    displayName: "Owner CipiSMP",
    passwordHash: await hashPassword(password),
    role: "OWNER",
    emailVerifiedAt: new Date(),
  });
  console.log(`[seed] Akun owner dibuat: ${username} <${email}>. Ganti password setelah login pertama.`);
}

async function main() {
  console.log("[seed] Mulai…");
  await seedSettings();
  await seedServer();
  const seasonId = await seedSeason();
  await seedProducts();
  await seedOwner();
  console.log(`[seed] Selesai. Season aktif: ${seasonId}`);
  await pool.end();
}

main().catch(async (error) => {
  console.error("[seed] Gagal:", error);
  await pool.end();
  process.exit(1);
});
