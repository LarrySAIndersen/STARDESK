-- MVP seed: subcategories, SLA assignments, routing, team escalation emails
-- Run after init.sql (safe to re-run with ON CONFLICT where noted).

UPDATE teams SET escalation_email = 'servicedesk@example.dk' WHERE name IN ('SF Service Desk', 'Service Desk');
UPDATE teams SET escalation_email = 'infra@example.dk' WHERE name IN ('SF Operations', 'Infrastruktur');
UPDATE teams SET escalation_email = 'app@example.dk' WHERE name = 'Applikation';

INSERT INTO subcategories (category_id, name, name_da, sort_order)
SELECT c.id, 'general', 'Generelt', 0
FROM categories c
WHERE NOT EXISTS (
    SELECT 1 FROM subcategories s WHERE s.category_id = c.id AND s.name = 'general'
);

INSERT INTO sla_assignments (sla_policy_id, priority)
SELECT p.id, v.priority
FROM sla_policies p
CROSS JOIN (VALUES ('critical'), ('high'), ('medium'), ('low')) AS v(priority)
WHERE p.name = CASE v.priority
    WHEN 'critical' THEN 'Critical (24/7)'
    WHEN 'high' THEN 'High'
    WHEN 'medium' THEN 'Medium'
    WHEN 'low' THEN 'Low'
END
AND NOT EXISTS (
    SELECT 1 FROM sla_assignments a
    WHERE a.sla_policy_id = p.id AND a.priority = v.priority AND a.category_id IS NULL
);

INSERT INTO routing_rules (
    name, description, priority_order, is_active, assign_team_id
)
SELECT
    'Default Service Desk',
    'Alle nye sager uden match sendes til Service Desk',
    1000,
    TRUE,
    t.id
FROM teams t
WHERE t.name IN ('SF Service Desk', 'Service Desk')
AND NOT EXISTS (
    SELECT 1 FROM routing_rules r WHERE r.name = 'Default Service Desk'
);

INSERT INTO routing_rules (
    name, description, priority_order, is_active,
    category_id, assign_team_id, set_priority, min_priority
)
SELECT
    'Netværk → Infrastruktur',
    'Netværkssager med høj prioritet',
    100,
    TRUE,
    c.id,
    t.id,
    'high',
    'high'
FROM categories c
JOIN teams t ON t.name IN ('SF Operations', 'Infrastruktur')
WHERE c.name = 'network'
AND NOT EXISTS (
    SELECT 1 FROM routing_rules r WHERE r.name = 'Netværk → Infrastruktur'
);
