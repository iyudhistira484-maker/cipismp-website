-- Catalog rank CipiSMP yang disetujui pemilik: Cute < Pop < Milk < Star.
-- Product IDs/slugs dipertahankan supaya order dan entitlement lama tetap tertaut.
UPDATE "products" AS product
SET
  "name" = rank."name",
  "tagline" = rank."tagline",
  "description" = rank."description",
  "price_idr" = rank."price_idr",
  "tier" = rank."tier",
  "accent" = rank."accent",
  "sort_order" = rank."sort_order",
  "perks" = rank."perks",
  "updated_at" = now()
FROM (
  VALUES
    (
      'cute-cipi', 'Cute Cipi',
      'Rank awal yang manis dengan fitur penting untuk mulai nyaman bermain.',
      'Cute Cipi adalah rank paling terjangkau. Nikmati prefix ✧CUTE CIPI✧, hingga 10 lelang, 3 AxVaults, /feed dan /heal, serta akses Kit VIP, Void, dan Cipi Basic. Termasuk beberapa home melalui EssentialsX dan bypass cooldown BetterRTP.',
      10000, 1, 'cute', 1,
      ARRAY['Prefix ✧CUTE CIPI✧', 'Limit auction 10', 'Multiple sethome VIP', '3 AxVaults', '/feed dan /heal', 'Kit VIP, Void, dan Cipi Basic', 'Bypass cooldown BetterRTP']::text[]
    ),
    (
      'pop-cipi', 'Pop Cipi',
      'Lebih banyak ruang, kemudahan, dan akses kit.',
      'Pop Cipi mencakup seluruh fitur Cute Cipi, lalu menambah prefix ✧POP CIPI✧, limit 15 lelang, 5 AxVaults, lebih banyak home, akses /fly, serta Kit MVP dan Cipi Basic.',
      30000, 2, 'pop', 2,
      ARRAY['Semua fitur Cute Cipi', 'Prefix ✧POP CIPI✧', 'Limit auction 15', 'Multiple sethome MVP', '5 AxVaults', '/fly', 'Kit MVP dan Cipi Basic']::text[]
    ),
    (
      'milk-cipi', 'Milk Cipi',
      'Fitur lebih lengkap untuk pemain yang aktif setiap hari.',
      'Milk Cipi mencakup seluruh fitur Pop Cipi. Rank ini menambahkan prefix ✧MILK CIPI✧, limit 20 lelang, 7 AxVaults dengan 6 baris per vault, serta akses Kit Elite dan Cipi Pro.',
      60000, 3, 'milk', 3,
      ARRAY['Semua fitur Pop Cipi', 'Prefix ✧MILK CIPI✧', 'Limit auction 20', 'Multiple sethome Elite', '7 AxVaults, 6 baris', 'Kit Elite dan Cipi Pro']::text[]
    ),
    (
      'star-cipi', 'Star Cipi',
      'Rank tertinggi dengan fitur paling lengkap.',
      'Star Cipi mencakup seluruh fitur Milk Cipi. Nikmati prefix ✧STAR CIPI✧, limit 30 lelang, 10 AxVaults dengan item picker, akses /god, serta Kit Legend dan Cipi Pro.',
      100000, 4, 'star', 4,
      ARRAY['Semua fitur Milk Cipi', 'Prefix ✧STAR CIPI✧', 'Limit auction 30', 'Multiple sethome Legend', '10 AxVaults + item picker', '/god', 'Kit Legend dan Cipi Pro']::text[]
    )
) AS rank("slug", "name", "tagline", "description", "price_idr", "tier", "accent", "sort_order", "perks")
WHERE product."type" = 'RANK'
  AND product."slug" = rank."slug";--> statement-breakpoint

-- GRANT memasang satu group rank sesuai permintaan (parent set).
-- REVOKE mengembalikan pemain ke group default saat entitlement berakhir.
INSERT INTO "command_templates" ("id", "product_id", "kind", "template")
SELECT
  'cmd_' || substr(md5(random()::text || clock_timestamp()::text || product."id" || command."kind"), 1, 18),
  product."id",
  command."kind"::"command_kind",
  command."template"
FROM (
  VALUES
    ('cute-cipi', 'GRANT', 'lp user {player} parent set vip'),
    ('cute-cipi', 'REVOKE', 'lp user {player} parent set default'),
    ('pop-cipi', 'GRANT', 'lp user {player} parent set mvp'),
    ('pop-cipi', 'REVOKE', 'lp user {player} parent set default'),
    ('milk-cipi', 'GRANT', 'lp user {player} parent set elite'),
    ('milk-cipi', 'REVOKE', 'lp user {player} parent set default'),
    ('star-cipi', 'GRANT', 'lp user {player} parent set legend'),
    ('star-cipi', 'REVOKE', 'lp user {player} parent set default')
) AS command("slug", "kind", "template")
JOIN "products" AS product
  ON product."slug" = command."slug"
 AND product."type" = 'RANK'
ON CONFLICT ("product_id", "kind") DO UPDATE SET
  "template" = EXCLUDED."template",
  "updated_at" = now();
