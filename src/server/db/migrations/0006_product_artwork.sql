ALTER TABLE "products" ADD COLUMN "artwork" text;--> statement-breakpoint
UPDATE "products"
SET "artwork" = CASE "slug"
  WHEN 'iron' THEN '/images/products/iron.jpg'
  WHEN 'gold' THEN '/images/products/gold.jpg'
  WHEN 'diamond' THEN '/images/products/diamond.jpg'
  WHEN 'starter' THEN '/images/products/starter.jpg'
  WHEN 'builder' THEN '/images/products/builder.jpg'
  WHEN 'explorer' THEN '/images/products/explorer.jpg'
  ELSE "artwork"
END
WHERE "artwork" IS NULL;--> statement-breakpoint
UPDATE "products" AS product
SET "slug" = 'star-cipi',
    "name" = 'Star Cipi',
    "tagline" = 'Awali season dengan sentuhan bintang.',
    "description" = 'Star Cipi adalah pijakan pertama untuk pemain yang mulai serius membangun. Prefix chat berwarna membuat obrolan lebih personal, tiga home tambahan memberi ruang untuk base dan tambang, sementara dua slot lelang ekstra membantu menjual hasil kebun atau redstone.',
    "artwork" = '/images/products/star-cipi.jpg',
    "price_idr" = 20000,
    "tier" = 1,
    "accent" = 'star',
    "status" = 'PUBLISHED',
    "sort_order" = 1,
    "perks" = ARRAY['Prefix chat Star Cipi', '3 home tambahan', '2 slot lelang ekstra']::text[],
    "updated_at" = now()
WHERE product."type" = 'RANK' AND product."slug" = 'iron'
  AND NOT EXISTS (SELECT 1 FROM "products" AS existing WHERE existing."slug" = 'star-cipi');--> statement-breakpoint
UPDATE "products" AS product
SET "slug" = 'milk-cipi',
    "name" = 'Milk Cipi',
    "tagline" = 'Kenyamanan lembut untuk pemain yang aktif setiap hari.',
    "description" = 'Milk Cipi membawa semua keuntungan Star Cipi, ditambah ruang home yang lebih luas, warna nickname, dan jejak partikel kosmetik. Pemiliknya juga mendapat antrean prioritas saat server penuh. Semua keuntungan berfokus pada kenyamanan dan kosmetik, bukan pertarungan.',
    "artwork" = '/images/products/milk-cipi.jpg',
    "price_idr" = 45000,
    "tier" = 2,
    "accent" = 'milk',
    "status" = 'PUBLISHED',
    "sort_order" = 2,
    "perks" = ARRAY['Semua keuntungan Star Cipi', '6 home tambahan', 'Jejak partikel kosmetik', 'Warna nickname', 'Antrean prioritas saat server penuh']::text[],
    "updated_at" = now()
WHERE product."type" = 'RANK' AND product."slug" = 'gold'
  AND NOT EXISTS (SELECT 1 FROM "products" AS existing WHERE existing."slug" = 'milk-cipi');--> statement-breakpoint
UPDATE "products" AS product
SET "slug" = 'pop-cipi',
    "name" = 'Pop Cipi',
    "tagline" = 'Warna dan kenyamanan untuk pemain yang kreatif.',
    "description" = 'Pop Cipi memberi ruang paling luas untuk membangun kota bersama tim: home tambahan, nickname kustom, blok klaim lahan tambahan, dan akses ke area hub kosmetik. Rank ini mewarisi kenyamanan tier sebelumnya tanpa menambah damage, speed, atau keunggulan PvP.',
    "artwork" = '/images/products/pop-cipi.jpg',
    "price_idr" = 80000,
    "tier" = 3,
    "accent" = 'pop',
    "status" = 'PUBLISHED',
    "sort_order" = 3,
    "perks" = ARRAY['Semua keuntungan Milk Cipi', '10 home tambahan', 'Nickname kustom', 'Blok klaim lahan tambahan', 'Akses area hub kosmetik']::text[],
    "updated_at" = now()
WHERE product."type" = 'RANK' AND product."slug" = 'diamond'
  AND NOT EXISTS (SELECT 1 FROM "products" AS existing WHERE existing."slug" = 'pop-cipi');--> statement-breakpoint
UPDATE "products"
SET "status" = 'DRAFT', "updated_at" = now()
WHERE "type" = 'RANK' AND "slug" IN ('iron', 'gold', 'diamond');--> statement-breakpoint
-- Pastikan tiga tier hasil rebrand tersedia walau deployment tidak menjalankan seed sesudah migrasi.
INSERT INTO "products" (
  "id", "slug", "type", "name", "tagline", "description", "artwork", "price_idr",
  "tier", "accent", "status", "sort_order", "max_per_season", "perks"
)
VALUES (
  'prd_' || substr(md5(random()::text || clock_timestamp()::text), 1, 18), 'star-cipi', 'RANK', 'Star Cipi',
  'Awali season dengan sentuhan bintang.',
  'Star Cipi adalah pijakan pertama untuk pemain yang mulai serius membangun. Prefix chat berwarna membuat obrolan lebih personal, tiga home tambahan memberi ruang untuk base dan tambang, sementara dua slot lelang ekstra membantu menjual hasil kebun atau redstone.',
  '/images/products/star-cipi.jpg', 20000, 1, 'star', 'PUBLISHED', 1, 1,
  ARRAY['Prefix chat Star Cipi', '3 home tambahan', '2 slot lelang ekstra']::text[]
), (
  'prd_' || substr(md5(random()::text || clock_timestamp()::text), 1, 18), 'milk-cipi', 'RANK', 'Milk Cipi',
  'Kenyamanan lembut untuk pemain yang aktif setiap hari.',
  'Milk Cipi membawa semua keuntungan Star Cipi, ditambah ruang home yang lebih luas, warna nickname, dan jejak partikel kosmetik. Pemiliknya juga mendapat antrean prioritas saat server penuh. Semua keuntungan berfokus pada kenyamanan dan kosmetik, bukan pertarungan.',
  '/images/products/milk-cipi.jpg', 45000, 2, 'milk', 'PUBLISHED', 2, 1,
  ARRAY['Semua keuntungan Star Cipi', '6 home tambahan', 'Jejak partikel kosmetik', 'Warna nickname', 'Antrean prioritas saat server penuh']::text[]
), (
  'prd_' || substr(md5(random()::text || clock_timestamp()::text), 1, 18), 'pop-cipi', 'RANK', 'Pop Cipi',
  'Warna dan kenyamanan untuk pemain yang kreatif.',
  'Pop Cipi memberi ruang paling luas untuk membangun kota bersama tim: home tambahan, nickname kustom, blok klaim lahan tambahan, dan akses ke area hub kosmetik. Rank ini mewarisi kenyamanan tier sebelumnya tanpa menambah damage, speed, atau keunggulan PvP.',
  '/images/products/pop-cipi.jpg', 80000, 3, 'pop', 'PUBLISHED', 3, 1,
  ARRAY['Semua keuntungan Milk Cipi', '10 home tambahan', 'Nickname kustom', 'Blok klaim lahan tambahan', 'Akses area hub kosmetik']::text[]
)
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "command_templates" ("id", "product_id", "kind", "template")
SELECT 'cmd_' || substr(md5(random()::text || clock_timestamp()::text), 1, 18), "id", 'GRANT', 'lp user {player} parent add iron'
FROM "products" WHERE "slug" = 'star-cipi'
ON CONFLICT ("product_id", "kind") DO NOTHING;--> statement-breakpoint
INSERT INTO "command_templates" ("id", "product_id", "kind", "template")
SELECT 'cmd_' || substr(md5(random()::text || clock_timestamp()::text), 1, 18), "id", 'REVOKE', 'lp user {player} parent remove iron'
FROM "products" WHERE "slug" = 'star-cipi'
ON CONFLICT ("product_id", "kind") DO NOTHING;--> statement-breakpoint
INSERT INTO "command_templates" ("id", "product_id", "kind", "template")
SELECT 'cmd_' || substr(md5(random()::text || clock_timestamp()::text), 1, 18), "id", 'GRANT', 'lp user {player} parent add gold'
FROM "products" WHERE "slug" = 'milk-cipi'
ON CONFLICT ("product_id", "kind") DO NOTHING;--> statement-breakpoint
INSERT INTO "command_templates" ("id", "product_id", "kind", "template")
SELECT 'cmd_' || substr(md5(random()::text || clock_timestamp()::text), 1, 18), "id", 'REVOKE', 'lp user {player} parent remove gold'
FROM "products" WHERE "slug" = 'milk-cipi'
ON CONFLICT ("product_id", "kind") DO NOTHING;--> statement-breakpoint
INSERT INTO "command_templates" ("id", "product_id", "kind", "template")
SELECT 'cmd_' || substr(md5(random()::text || clock_timestamp()::text), 1, 18), "id", 'GRANT', 'lp user {player} parent add diamond'
FROM "products" WHERE "slug" = 'pop-cipi'
ON CONFLICT ("product_id", "kind") DO NOTHING;--> statement-breakpoint
INSERT INTO "command_templates" ("id", "product_id", "kind", "template")
SELECT 'cmd_' || substr(md5(random()::text || clock_timestamp()::text), 1, 18), "id", 'REVOKE', 'lp user {player} parent remove diamond'
FROM "products" WHERE "slug" = 'pop-cipi'
ON CONFLICT ("product_id", "kind") DO NOTHING;--> statement-breakpoint
-- Rank baru tertinggi; seed aman dijalankan ulang dan tidak mengganti pengaturan admin.
INSERT INTO "products" (
  "id", "slug", "type", "name", "tagline", "description", "artwork", "price_idr",
  "tier", "accent", "status", "sort_order", "max_per_season", "perks"
)
VALUES (
  'prd_' || substr(md5(random()::text || clock_timestamp()::text), 1, 18),
  'cute-cipi', 'RANK', 'Cute Cipi',
  'Pilihan paling lengkap dengan sentuhan kosmetik yang manis.',
  'Cute Cipi melengkapi seluruh kenyamanan Pop Cipi dengan identitas chat dan kosmetik bertema Cute Cipi. Cocok untuk pemain yang ingin ruang membangun lebih lega sekaligus tampil khas di komunitas. Semua efeknya kosmetik dan kenyamanan.',
  '/images/products/cute-cipi.jpg', 120000, 4, 'cute', 'PUBLISHED', 4, 1,
  ARRAY['Semua keuntungan Pop Cipi', 'Prefix chat Cute Cipi', 'Efek partikel kosmetik eksklusif', '4 home tambahan', 'Slot lelang ekstra']::text[]
)
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "command_templates" ("id", "product_id", "kind", "template")
SELECT 'cmd_' || substr(md5(random()::text || clock_timestamp()::text), 1, 18), "id", 'GRANT', 'lp user {player} parent add cute-cipi'
FROM "products" WHERE "slug" = 'cute-cipi'
ON CONFLICT ("product_id", "kind") DO NOTHING;--> statement-breakpoint
INSERT INTO "command_templates" ("id", "product_id", "kind", "template")
SELECT 'cmd_' || substr(md5(random()::text || clock_timestamp()::text), 1, 18), "id", 'REVOKE', 'lp user {player} parent remove cute-cipi'
FROM "products" WHERE "slug" = 'cute-cipi'
ON CONFLICT ("product_id", "kind") DO NOTHING;--> statement-breakpoint
-- Pertahankan template LuckPerms lama untuk Iron/Gold/Diamond (nama group server); admin bisa mengubahnya.