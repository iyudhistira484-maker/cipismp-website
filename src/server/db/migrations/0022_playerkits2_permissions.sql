-- Only exact built-in GRANT/REVOKE pairs, on products without ANY entitlement
-- or delivery history, can change. Never rewrite queues or historical rights.
-- Both 0021's Essentials defaults and the earlier plural PlayerKits typo are
-- recognized; mixed/custom/duplicate pairs must be reconciled manually.
WITH defaults(slug, old_permission, new_permission) AS (
  VALUES
    ('cipiprime', 'essentials.kits.cipiprime', 'playerkits.kit.cipiprime'),
    ('cipiprime', 'playerkits.kits.cipiprime', 'playerkits.kit.cipiprime'),
    ('cipi-plus-plus', 'essentials.kits.cipi++', 'playerkits.kit.cipi++'),
    ('cipi-plus-plus', 'playerkits.kits.cipi++', 'playerkits.kit.cipi++')
), safe_pairs AS (
  SELECT p.id, d.new_permission
  FROM products p
  JOIN defaults d ON d.slug = p.slug
  JOIN command_templates g ON g.product_id = p.id AND g.kind = 'GRANT'
  JOIN command_templates r ON r.product_id = p.id AND r.kind = 'REVOKE'
  WHERE p.type = 'KIT'
    AND NOT EXISTS (SELECT 1 FROM entitlements e WHERE e.product_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM deliveries x WHERE x.product_id = p.id)
    AND (SELECT count(*) FROM command_templates t WHERE t.product_id = p.id AND t.kind IN ('GRANT', 'REVOKE')) = 2
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
-- Fix only exact 0021 default copy; never overwrite owner-edited text. This is
-- independent of template migration and does not mean historical rights work.
WITH defaults(slug, old_tagline, new_tagline, old_description, new_description) AS (
  VALUES
    ('cipiprime',
     'Akses kit Diamond lewat Essentials selama satu season.',
     'Akses kit Diamond lewat PlayerKits2 selama satu season.',
     'Pembelian mengaktifkan akses CipiPrime di Essentials sampai season berakhir. Klaim kit dapat diulang dengan cooldown yang diatur di server.',
     'Pembelian mengaktifkan akses CipiPrime di PlayerKits2 sampai season berakhir. Klaim kit dapat diulang dengan cooldown yang diatur di server.'),
    ('cipi-plus-plus',
     'Akses kit Netherite lewat Essentials selama satu season.',
     'Akses kit Netherite lewat PlayerKits2 selama satu season.',
     'Pembelian mengaktifkan akses Cipi++ di Essentials sampai season berakhir. Klaim kit dapat diulang dengan cooldown yang diatur di server.',
     'Pembelian mengaktifkan akses Cipi++ di PlayerKits2 sampai season berakhir. Klaim kit dapat diulang dengan cooldown yang diatur di server.')
)
UPDATE products p
SET tagline = CASE WHEN p.tagline = d.old_tagline THEN d.new_tagline ELSE p.tagline END,
    description = CASE WHEN p.description = d.old_description THEN d.new_description ELSE p.description END,
    perks = CASE WHEN p.perks = ARRAY['Akses kit Essentials sampai season berakhir', 'Cooldown klaim diatur oleh server', 'Dibeli sekali per pemain setiap season']::text[]
      THEN ARRAY['Akses kit PlayerKits2 sampai season berakhir', 'Cooldown klaim diatur oleh server', 'Dibeli sekali per pemain setiap season']::text[]
      ELSE p.perks END,
    updated_at = now()
FROM defaults d
WHERE p.slug = d.slug AND p.type = 'KIT'
  AND (p.tagline = d.old_tagline OR p.description = d.old_description
       OR p.perks = ARRAY['Akses kit Essentials sampai season berakhir', 'Cooldown klaim diatur oleh server', 'Dibeli sekali per pemain setiap season']::text[]);
