/**
 * Seed data CipiSMP Store — idempoten, aman dijalankan berulang.
 * Melengkapi data default yang belum ada tanpa menimpa perubahan dari dashboard admin.
 * Membuat: pengaturan toko, server, Season 1, 4 rank, 3 kit, template perintah,
 * kupon contoh, dan akun Owner dari env (SEED_OWNER_*). Tidak ada kredensial hardcoded.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/server/db";
import {
  commandTemplates,
  coupons,
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
import { addDays } from "../src/lib/dates";

interface RankSeed {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  priceIdr: number;
  tier: number;
  accent: string;
  perks: string[];
  rankName: string;
  sortOrder: number;
  artwork: string;
}

const RANKS: RankSeed[] = [
  {
    slug: "star-cipi",
    name: "Star Cipi",
    tagline: "Awali season dengan sentuhan bintang.",
    description:
      "Star Cipi adalah pijakan pertama untuk pemain yang mulai serius membangun. Prefix chat berwarna membuat obrolan lebih personal, tiga home tambahan memberi ruang untuk base dan tambang, sementara dua slot lelang ekstra membantu menjual hasil kebun atau redstone.",
    priceIdr: 20_000,
    tier: 1,
    accent: "star",
    perks: ["Prefix chat Star Cipi", "3 home tambahan", "2 slot lelang ekstra"],
    rankName: "iron",
    sortOrder: 1,
    artwork: "/images/products/star-cipi.jpg",
  },
  {
    slug: "milk-cipi",
    name: "Milk Cipi",
    tagline: "Kenyamanan lembut untuk pemain yang aktif setiap hari.",
    description:
      "Milk Cipi membawa semua keuntungan Star Cipi, ditambah ruang home yang lebih luas, warna nickname, dan jejak partikel kosmetik. Pemiliknya juga mendapat antrean prioritas saat server penuh. Semua keuntungan berfokus pada kenyamanan dan kosmetik, bukan pertarungan.",
    priceIdr: 45_000,
    tier: 2,
    accent: "milk",
    perks: [
      "Semua keuntungan Star Cipi",
      "6 home tambahan",
      "Jejak partikel kosmetik",
      "Warna nickname",
      "Antrean prioritas saat server penuh",
    ],
    rankName: "gold",
    sortOrder: 2,
    artwork: "/images/products/milk-cipi.jpg",
  },
  {
    slug: "pop-cipi",
    name: "Pop Cipi",
    tagline: "Warna dan kenyamanan untuk pemain yang kreatif.",
    description:
      "Pop Cipi memberi ruang paling luas untuk membangun kota bersama tim: home tambahan, nickname kustom, blok klaim lahan tambahan, dan akses ke area hub kosmetik. Rank ini mewarisi kenyamanan tier sebelumnya tanpa menambah damage, speed, atau keunggulan PvP.",
    priceIdr: 80_000,
    tier: 3,
    accent: "pop",
    perks: [
      "Semua keuntungan Milk Cipi",
      "10 home tambahan",
      "Nickname kustom",
      "Blok klaim lahan tambahan",
      "Akses area hub kosmetik",
    ],
    rankName: "diamond",
    sortOrder: 3,
    artwork: "/images/products/pop-cipi.jpg",
  },
  {
    slug: "cute-cipi",
    name: "Cute Cipi",
    tagline: "Pilihan paling lengkap dengan sentuhan kosmetik yang manis.",
    description:
      "Cute Cipi melengkapi seluruh kenyamanan Pop Cipi dengan identitas chat dan kosmetik bertema Cute Cipi. Cocok untuk pemain yang ingin ruang membangun lebih lega sekaligus tampil khas di komunitas. Semua efeknya kosmetik dan kenyamanan.",
    priceIdr: 120_000,
    tier: 4,
    accent: "cute",
    perks: [
      "Semua keuntungan Pop Cipi",
      "Prefix chat Cute Cipi",
      "Efek partikel kosmetik eksklusif",
      "4 home tambahan",
      "Slot lelang ekstra",
    ],
    rankName: "cute-cipi",
    sortOrder: 4,
    artwork: "/images/products/cute-cipi.jpg",
  },
];

interface KitSeed {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  priceIdr: number;
  sortOrder: number;
  artwork: string;
  items: Array<{
    itemKey: string;
    name: string;
    quantity: number;
    enchantments?: string[];
    lore?: string[];
  }>;
}

const KITS: KitSeed[] = [
  {
    slug: "starter",
    name: "Starter Kit",
    tagline: "Bekal awal yang jujur: makan, alat, terang, dan tempat tidur.",
    description:
      "Dibuat untuk hari pertama di season baru. Isinya cukup untuk bertahan melewati malam pertama tanpa harus menebang pohon dalam gelap: makanan, alat batu, obor, dan satu tempat tidur untuk menetapkan titik respawn. Bisa diambil sekali per pemain di setiap season.",
    priceIdr: 10_000,
    sortOrder: 1,
    artwork: "/images/products/starter.jpg",
    items: [
      { itemKey: "bread", name: "Roti", quantity: 16 },
      { itemKey: "stone_sword", name: "Pedang Batu", quantity: 1 },
      { itemKey: "stone_pickaxe", name: "Beliung Batu", quantity: 1 },
      { itemKey: "stone_axe", name: "Kapak Batu", quantity: 1 },
      { itemKey: "torch", name: "Obor", quantity: 32 },
      { itemKey: "bed", name: "Tempat Tidur", quantity: 1, lore: ["Titik respawn"] },
      { itemKey: "oak_planks", name: "Papan Kayu Ek", quantity: 32 },
      { itemKey: "cooked_beef", name: "Steak", quantity: 8, lore: ["Makanan pulih lebih banyak"] },
    ],
  },
  {
    slug: "builder",
    name: "Builder Kit",
    tagline: "Blok bangunan umum dalam jumlah yang benar-benar terpakai.",
    description:
      "Satu tumpuk penuh blok yang paling sering habis saat membangun: papan, batu bata, batu halus, dan kaca. Tidak ada blok dekorasi langka di sini — hanya material dasar yang membuat dinding pertama cepat berdiri. Sekali per pemain per season.",
    priceIdr: 25_000,
    sortOrder: 2,
    artwork: "/images/products/builder.jpg",
    items: [
      { itemKey: "oak_planks", name: "Papan Kayu Ek", quantity: 64 },
      { itemKey: "stone_bricks", name: "Batu Bata", quantity: 64 },
      { itemKey: "smooth_stone", name: "Batu Halus", quantity: 64 },
      { itemKey: "glass", name: "Kaca", quantity: 64 },
      { itemKey: "oak_log", name: "Kayu Ek", quantity: 32 },
      { itemKey: "lantern", name: "Lentera", quantity: 16, lore: ["Sumber cahaya dekoratif"] },
      { itemKey: "scaffolding", name: "Perancah", quantity: 32 },
      { itemKey: "ladder", name: "Tangga", quantity: 32 },
    ],
  },
  {
    slug: "explorer",
    name: "Explorer Kit",
    tagline: "Untuk yang pergi jauh dan tidak ingin pulang cepat.",
    description:
      "Berisi peralatan navigasi dan logistik untuk perjalanan panjang: peta, kompas, perahu, ender chest untuk menyimpan hasil temuan, dan saddle untuk membawa pulang hewan langka. Makanan dan obor sudah termasuk supaya perjalanan pertama tidak berakhir di lava.",
    priceIdr: 30_000,
    sortOrder: 3,
    artwork: "/images/products/explorer.jpg",
    items: [
      { itemKey: "map", name: "Peta Kosong", quantity: 1 },
      { itemKey: "compass", name: "Kompas", quantity: 1, lore: ["Menunjuk ke titik spawn"] },
      { itemKey: "boat", name: "Perahu Ek", quantity: 1 },
      { itemKey: "ender_chest", name: "Ender Chest", quantity: 1, lore: ["Penyimpanan pribadi portabel"] },
      { itemKey: "saddle", name: "Saddle", quantity: 1 },
      { itemKey: "cooked_beef", name: "Steak", quantity: 16 },
      { itemKey: "torch", name: "Obor", quantity: 64 },
      { itemKey: "iron_pickaxe", name: "Beliung Besi", quantity: 1, enchantments: ["Efisiensi II"] },
    ],
  },
];

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
    pluginBaseUrl: "http://plugin:8080",
    rconHost: "127.0.0.1",
    rconPort: 25575,
  });
}

async function seedSeason(): Promise<string> {
  const existing = await db.query.seasons.findFirst({ where: eq(seasons.slug, "season-1") });
  if (existing) return existing.id;
  const start = new Date();
  const id = ids.season();
  await db.insert(seasons).values({
    id,
    name: "Season 1",
    slug: "season-1",
    startAt: start,
    endAt: addDays(start, 90),
    status: "ACTIVE",
    freezeDays: 3,
    notes: "Season pembuka CipiSMP. Rank & kit berlaku sampai akhir season.",
  });
  return id;
}

async function seedProducts(seasonId: string) {
  for (const rank of RANKS) {
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
      perks: rank.perks,
      maxPerSeason: 1,
    });
    await upsertCommands(productId, {
      grant: `lp user {player} parent add ${rank.rankName}`,
      revoke: `lp user {player} parent remove ${rank.rankName}`,
    });
  }

  for (const kit of KITS) {
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
      artwork: kit.artwork,
      priceIdr: kit.priceIdr,
      tier: 0,
      accent: "amber",
      status: "PUBLISHED",
      sortOrder: kit.sortOrder,
      perks: ["Sekali per pemain setiap season", "Berlaku sampai akhir season"],
      maxPerSeason: 1,
    });
    await db.insert(kitItems).values(
      kit.items.map((item, index) => ({
        id: ids.kitItem(),
        productId,
        slot: index,
        itemKey: item.itemKey,
        name: item.name,
        quantity: item.quantity,
        enchantments: item.enchantments ?? [],
        lore: item.lore ?? [],
      })),
    );
    await upsertCommands(productId, {
      grant: `kit ${kit.slug} {player}`,
      revoke: `# kit tidak perlu dicabut saat season berakhir`,
      extra: `lp user {player} permission set cipismp.kit.${kit.slug}.season ${seasonId}`,
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

async function seedCoupons() {
  const samples = [
    {
      code: "SEASON1AWAL",
      type: "PERCENT" as const,
      value: 10,
      minSubtotalIdr: 25_000,
      maxRedemptions: 100,
      maxPerUser: 1,
      active: true,
    },
  ];
  for (const coupon of samples) {
    await db
      .insert(coupons)
      .values({ id: ids.coupon(), ...coupon })
      .onConflictDoNothing({ target: coupons.code });
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
  await seedProducts(seasonId);
  await seedCoupons();
  await seedOwner();
  console.log(`[seed] Selesai. Season aktif: ${seasonId}`);
  await pool.end();
}

main().catch(async (error) => {
  console.error("[seed] Gagal:", error);
  await pool.end();
  process.exit(1);
});
