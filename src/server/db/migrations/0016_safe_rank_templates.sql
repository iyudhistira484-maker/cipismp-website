-- Replace only untouched 0008 template pairs. Custom or partially modified
-- templates are intentionally left for owner review. Existing delivery rows
-- contain copied commands and are NOT altered by this migration.
WITH defaults(slug, group_name) AS (
  VALUES ('cute-cipi', 'vip'), ('pop-cipi', 'mvp'), ('milk-cipi', 'elite'), ('star-cipi', 'legend')
), safe_pairs AS (
  SELECT p.id, d.group_name
  FROM products p JOIN defaults d ON p.slug = d.slug
  JOIN command_templates g ON g.product_id = p.id AND g.kind = 'GRANT'
  JOIN command_templates r ON r.product_id = p.id AND r.kind = 'REVOKE'
  WHERE p.type = 'RANK'
    AND g.template = 'lp user {player} parent set ' || d.group_name
    AND r.template = 'lp user {player} parent set default'
)
UPDATE command_templates c
SET template = CASE c.kind
  WHEN 'GRANT' THEN 'lp user {player} parent add ' || s.group_name
  ELSE 'lp user {player} parent remove ' || s.group_name END,
  updated_at = now()
FROM safe_pairs s
WHERE c.product_id = s.id AND c.kind IN ('GRANT', 'REVOKE');
