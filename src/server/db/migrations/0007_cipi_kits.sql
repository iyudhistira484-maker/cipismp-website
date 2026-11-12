-- Replace the sample kits with the two current, season-long PlayerKits access products.
UPDATE "products"
SET "status" = 'DRAFT', "updated_at" = now()
WHERE "type" = 'KIT'
  AND "slug" IN ('starter', 'builder', 'explorer')
  AND "deleted_at" IS NULL;--> statement-breakpoint

INSERT INTO "products" (
  "id", "slug", "type", "name", "tagline", "description", "artwork", "price_idr",
  "tier", "accent", "status", "sort_order", "max_per_season", "cooldown_hours",
  "use_server_commands", "perks", "updated_at"
)
VALUES
  (
    'prd_' || substr(md5(random()::text || clock_timestamp()::text), 1, 18),
    'cipiprime', 'KIT', 'CipiPrime',
    'Akses kit Diamond lewat PlayerKits selama satu season.',
    'Pembelian mengaktifkan akses CipiPrime di PlayerKits sampai season berakhir. Klaim kit dapat diulang dengan cooldown 5 jam yang diatur di server.',
    NULL, 35000, 0, 'amber', 'PUBLISHED', 1, 1, 0, true,
    ARRAY['Akses PlayerKits sampai season berakhir', 'Cooldown klaim 5 jam diatur oleh PlayerKits', 'Dibeli sekali per pemain setiap season']::text[], now()
  ),
  (
    'prd_' || substr(md5(random()::text || clock_timestamp()::text), 1, 18),
    'cipi-plus-plus', 'KIT', 'Cipi++',
    'Akses kit Netherite lewat PlayerKits selama satu season.',
    'Pembelian mengaktifkan akses Cipi++ di PlayerKits sampai season berakhir. Klaim kit dapat diulang dengan cooldown 5 jam yang diatur di server.',
    NULL, 75000, 0, 'amber', 'PUBLISHED', 2, 1, 0, true,
    ARRAY['Akses PlayerKits sampai season berakhir', 'Cooldown klaim 5 jam diatur oleh PlayerKits', 'Dibeli sekali per pemain setiap season']::text[], now()
  )
ON CONFLICT ("slug") DO UPDATE SET
  "type" = EXCLUDED."type",
  "name" = EXCLUDED."name",
  "tagline" = EXCLUDED."tagline",
  "description" = EXCLUDED."description",
  "artwork" = NULL,
  "price_idr" = EXCLUDED."price_idr",
  "tier" = EXCLUDED."tier",
  "accent" = EXCLUDED."accent",
  "status" = EXCLUDED."status",
  "sort_order" = EXCLUDED."sort_order",
  "max_per_season" = EXCLUDED."max_per_season",
  "cooldown_hours" = EXCLUDED."cooldown_hours",
  "use_server_commands" = EXCLUDED."use_server_commands",
  "perks" = EXCLUDED."perks",
  "deleted_at" = NULL,
  "updated_at" = now();--> statement-breakpoint

DELETE FROM "kit_items" AS item
USING "products" AS product
WHERE item."product_id" = product."id"
  AND product."type" = 'KIT'
  AND product."slug" IN ('cipiprime', 'cipi-plus-plus');--> statement-breakpoint

INSERT INTO "kit_items" (
  "id", "product_id", "slot", "item_key", "name", "quantity", "enchantments", "lore"
)
SELECT
  'kit_' || substr(md5(random()::text || clock_timestamp()::text || item."item_key" || item."slot"::text), 1, 18),
  product."id", item."slot", item."item_key", item."name", item."quantity", item."enchantments", item."lore"
FROM (
  VALUES
    ('cipiprime', 0, 'diamond_sword', 'Diamond Sword', 1, ARRAY['Sharpness III', 'Unbreaking III']::text[], ARRAY[]::text[]),
    ('cipiprime', 1, 'diamond_pickaxe', 'Diamond Pickaxe', 1, ARRAY['Efficiency IV', 'Unbreaking III']::text[], ARRAY[]::text[]),
    ('cipiprime', 2, 'diamond_axe', 'Diamond Axe', 1, ARRAY['Efficiency IV', 'Unbreaking III']::text[], ARRAY[]::text[]),
    ('cipiprime', 3, 'diamond_shovel', 'Diamond Shovel', 1, ARRAY['Efficiency IV', 'Unbreaking III']::text[], ARRAY[]::text[]),
    ('cipiprime', 4, 'cooked_beef', 'Cooked Beef', 64, ARRAY[]::text[], ARRAY[]::text[]),
    ('cipiprime', 5, 'golden_carrot', 'Golden Carrot', 64, ARRAY[]::text[], ARRAY[]::text[]),
    ('cipiprime', 6, 'diamond_helmet', 'Diamond Helmet', 1, ARRAY['Protection III', 'Unbreaking III']::text[], ARRAY[]::text[]),
    ('cipiprime', 7, 'diamond_chestplate', 'Diamond Chestplate', 1, ARRAY['Protection III', 'Unbreaking III']::text[], ARRAY[]::text[]),
    ('cipiprime', 8, 'diamond_leggings', 'Diamond Leggings', 1, ARRAY['Protection III', 'Unbreaking III']::text[], ARRAY[]::text[]),
    ('cipiprime', 9, 'diamond_boots', 'Diamond Boots', 1, ARRAY['Protection III', 'Unbreaking III']::text[], ARRAY[]::text[]),
    ('cipiprime', 10, 'ender_pearl', 'Ender Pearl', 16, ARRAY[]::text[], ARRAY[]::text[]),
    ('cipiprime', 11, 'golden_apple', 'Golden Apple', 4, ARRAY[]::text[], ARRAY[]::text[]),
    ('cipi-plus-plus', 0, 'netherite_sword', 'Netherite Sword', 1, ARRAY['Sharpness IV', 'Unbreaking III']::text[], ARRAY[]::text[]),
    ('cipi-plus-plus', 1, 'netherite_pickaxe', 'Netherite Pickaxe', 1, ARRAY['Efficiency V', 'Unbreaking III']::text[], ARRAY[]::text[]),
    ('cipi-plus-plus', 2, 'diamond_axe', 'Diamond Axe', 1, ARRAY['Efficiency V', 'Unbreaking III']::text[], ARRAY[]::text[]),
    ('cipi-plus-plus', 3, 'diamond_shovel', 'Diamond Shovel', 1, ARRAY['Efficiency V', 'Unbreaking III']::text[], ARRAY[]::text[]),
    ('cipi-plus-plus', 4, 'cooked_beef', 'Cooked Beef', 64, ARRAY[]::text[], ARRAY[]::text[]),
    ('cipi-plus-plus', 5, 'golden_carrot', 'Golden Carrot', 64, ARRAY[]::text[], ARRAY[]::text[]),
    ('cipi-plus-plus', 6, 'netherite_helmet', 'Netherite Helmet', 1, ARRAY['Protection IV', 'Unbreaking III']::text[], ARRAY[]::text[]),
    ('cipi-plus-plus', 7, 'netherite_chestplate', 'Netherite Chestplate', 1, ARRAY['Protection IV', 'Unbreaking III']::text[], ARRAY[]::text[]),
    ('cipi-plus-plus', 8, 'netherite_leggings', 'Netherite Leggings', 1, ARRAY['Protection IV', 'Unbreaking III']::text[], ARRAY[]::text[]),
    ('cipi-plus-plus', 9, 'netherite_boots', 'Netherite Boots', 1, ARRAY['Protection IV', 'Unbreaking III']::text[], ARRAY[]::text[]),
    ('cipi-plus-plus', 10, 'ender_pearl', 'Ender Pearl', 32, ARRAY[]::text[], ARRAY[]::text[]),
    ('cipi-plus-plus', 11, 'golden_apple', 'Golden Apple', 8, ARRAY[]::text[], ARRAY[]::text[]),
    ('cipi-plus-plus', 12, 'totem_of_undying', 'Totem of Undying', 1, ARRAY[]::text[], ARRAY[]::text[])
) AS item("slug", "slot", "item_key", "name", "quantity", "enchantments", "lore")
JOIN "products" AS product
  ON product."slug" = item."slug"
 AND product."type" = 'KIT';--> statement-breakpoint

INSERT INTO "command_templates" ("id", "product_id", "kind", "template")
SELECT
  'cmd_' || substr(md5(random()::text || clock_timestamp()::text), 1, 18),
  product."id",
  command."kind"::"command_kind",
  command."template"
FROM (
  VALUES
    ('cipiprime', 'GRANT', 'lp user {player} permission set playerkits.kits.cipiprime true'),
    ('cipiprime', 'REVOKE', 'lp user {player} permission unset playerkits.kits.cipiprime'),
    ('cipi-plus-plus', 'GRANT', 'lp user {player} permission set playerkits.kits.cipi++ true'),
    ('cipi-plus-plus', 'REVOKE', 'lp user {player} permission unset playerkits.kits.cipi++')
) AS command("slug", "kind", "template")
JOIN "products" AS product
  ON product."slug" = command."slug"
 AND product."type" = 'KIT'
ON CONFLICT ("product_id", "kind") DO UPDATE SET
  "template" = EXCLUDED."template",
  "updated_at" = now();
