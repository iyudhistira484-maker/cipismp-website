ALTER TABLE "minecraft_profiles" ADD COLUMN "identity_verified_version" integer;--> statement-breakpoint
-- Change only complete, untouched default pairs. Existing delivery rows and custom
-- or partially customized templates are deliberately untouched.
WITH defaults(slug, group_name) AS (
  VALUES ('cute-cipi', 'vip'), ('pop-cipi', 'mvp'), ('milk-cipi', 'elite'), ('star-cipi', 'legend')
), safe_pairs AS (
  SELECT p.id, d.group_name FROM products p JOIN defaults d ON p.slug = d.slug
  JOIN command_templates g ON g.product_id = p.id AND g.kind = 'GRANT'
  JOIN command_templates r ON r.product_id = p.id AND r.kind = 'REVOKE'
  WHERE p.type = 'RANK' AND g.template = 'lp user {player} parent add ' || d.group_name
    AND r.template = 'lp user {player} parent remove ' || d.group_name
)
UPDATE command_templates c SET template = CASE c.kind
  WHEN 'GRANT' THEN 'lp user {uuid} parent add ' || s.group_name
  ELSE 'lp user {uuid} parent remove ' || s.group_name END, updated_at = now()
FROM safe_pairs s WHERE c.product_id = s.id AND c.kind IN ('GRANT', 'REVOKE');
--> statement-breakpoint
WITH defaults(slug, permission) AS (
  VALUES ('cipiprime', 'playerkits.kits.cipiprime'), ('cipi-plus-plus', 'playerkits.kits.cipi++')
), safe_pairs AS (
  SELECT p.id, d.permission FROM products p JOIN defaults d ON p.slug = d.slug
  JOIN command_templates g ON g.product_id = p.id AND g.kind = 'GRANT'
  JOIN command_templates r ON r.product_id = p.id AND r.kind = 'REVOKE'
  WHERE p.type = 'KIT' AND g.template = 'lp user {player} permission set ' || d.permission || ' true'
    AND r.template = 'lp user {player} permission unset ' || d.permission
)
UPDATE command_templates c SET template = CASE c.kind
  WHEN 'GRANT' THEN 'lp user {uuid} permission set ' || s.permission || ' true'
  ELSE 'lp user {uuid} permission unset ' || s.permission END, updated_at = now()
FROM safe_pairs s WHERE c.product_id = s.id AND c.kind IN ('GRANT', 'REVOKE');
