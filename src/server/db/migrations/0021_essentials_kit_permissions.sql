-- Switch only completely untouched legacy template pairs on products with NO
-- entitlement or delivery history. Existing grants, revocations, queued work,
-- custom templates and partially edited pairs require manual reconciliation.
-- In particular, never change the revocation target for a previously granted kit.
WITH defaults(slug, old_permission, new_permission) AS (
  VALUES
    ('cipiprime', 'playerkits.kits.cipiprime', 'essentials.kits.cipiprime'),
    ('cipi-plus-plus', 'playerkits.kits.cipi++', 'essentials.kits.cipi++')
), safe_pairs AS (
  SELECT p.id, d.new_permission
  FROM products p
  JOIN defaults d ON d.slug = p.slug
  JOIN command_templates g ON g.product_id = p.id AND g.kind = 'GRANT'
  JOIN command_templates r ON r.product_id = p.id AND r.kind = 'REVOKE'
  WHERE p.type = 'KIT'
    AND NOT EXISTS (SELECT 1 FROM entitlements e WHERE e.product_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM deliveries x WHERE x.product_id = p.id)
    AND (
      (g.template = 'lp user {uuid} permission set ' || d.old_permission || ' true'
       AND r.template = 'lp user {uuid} permission unset ' || d.old_permission)
      OR
      (g.template = 'lp user {player} permission set ' || d.old_permission || ' true'
       AND r.template = 'lp user {player} permission unset ' || d.old_permission)
    )
)
UPDATE command_templates c
SET template = CASE c.kind
  WHEN 'GRANT' THEN 'lp user {uuid} permission set ' || s.new_permission || ' true'
  ELSE 'lp user {uuid} permission unset ' || s.new_permission END,
  updated_at = now()
FROM safe_pairs s
WHERE c.product_id = s.id AND c.kind IN ('GRANT', 'REVOKE');
--> statement-breakpoint
-- Update only the exact former default marketing copy, leaving owner edits intact.
WITH defaults(slug, old_tagline, new_tagline, old_description, new_description) AS (
  VALUES
    ('cipiprime',
     'Akses kit Diamond lewat PlayerKits selama satu season.',
     'Akses kit Diamond lewat Essentials selama satu season.',
     'Pembelian mengaktifkan akses CipiPrime di PlayerKits sampai season berakhir. Klaim kit dapat diulang dengan cooldown 5 jam yang diatur di server.',
     'Pembelian mengaktifkan akses CipiPrime di Essentials sampai season berakhir. Klaim kit dapat diulang dengan cooldown yang diatur di server.'),
    ('cipi-plus-plus',
     'Akses kit Netherite lewat PlayerKits selama satu season.',
     'Akses kit Netherite lewat Essentials selama satu season.',
     'Pembelian mengaktifkan akses Cipi++ di PlayerKits sampai season berakhir. Klaim kit dapat diulang dengan cooldown 5 jam yang diatur di server.',
     'Pembelian mengaktifkan akses Cipi++ di Essentials sampai season berakhir. Klaim kit dapat diulang dengan cooldown yang diatur di server.')
)
UPDATE products p
SET tagline = CASE WHEN p.tagline = d.old_tagline THEN d.new_tagline ELSE p.tagline END,
    description = CASE WHEN p.description = d.old_description THEN d.new_description ELSE p.description END,
    perks = CASE WHEN p.perks = ARRAY['Akses PlayerKits sampai season berakhir', 'Cooldown klaim 5 jam diatur oleh PlayerKits', 'Dibeli sekali per pemain setiap season']::text[]
      THEN ARRAY['Akses kit Essentials sampai season berakhir', 'Cooldown klaim diatur oleh server', 'Dibeli sekali per pemain setiap season']::text[]
      ELSE p.perks END,
    updated_at = now()
FROM defaults d
WHERE p.slug = d.slug AND p.type = 'KIT'
  AND (p.tagline = d.old_tagline OR p.description = d.old_description
       OR p.perks = ARRAY['Akses PlayerKits sampai season berakhir', 'Cooldown klaim 5 jam diatur oleh PlayerKits', 'Dibeli sekali per pemain setiap season']::text[]);
