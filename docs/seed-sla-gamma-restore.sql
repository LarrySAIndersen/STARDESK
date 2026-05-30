-- Restore SLA policies to gamma / production standard (20260517_sla migration + init.sql)
-- Safe to re-run.

UPDATE sla_policies SET
    description = 'Kritisk P1 — respons 1 t, løsning 4 timer (24/7)',
    response_time_minutes = 60,
    resolution_time_minutes = 240,
    business_hours_only = FALSE,
    is_active = TRUE,
    updated_at = NOW()
WHERE name = 'Critical (24/7)';

UPDATE sla_policies SET
    description = 'Høj P2 — respons 2 t, løsning 8 timer (24/7)',
    response_time_minutes = 120,
    resolution_time_minutes = 480,
    business_hours_only = FALSE,
    is_active = TRUE,
    updated_at = NOW()
WHERE name = 'High';

UPDATE sla_policies SET
    description = 'Mellem P3 — respons 1 hverdag, løsning 3 hverdage',
    response_time_minutes = 480,
    resolution_time_minutes = 4320,
    business_hours_only = TRUE,
    is_active = TRUE,
    updated_at = NOW()
WHERE name = 'Medium';

UPDATE sla_policies SET
    description = 'Lav P4 — respons 1 hverdag, løsning 5 hverdage',
    response_time_minutes = 480,
    resolution_time_minutes = 7200,
    business_hours_only = TRUE,
    is_active = TRUE,
    updated_at = NOW()
WHERE name = 'Low';

INSERT INTO sla_policies (name, description, response_time_minutes, resolution_time_minutes, business_hours_only)
SELECT v.name, v.description, v.response_min, v.resolution_min, v.business_only
FROM (VALUES
    ('Critical (24/7)', 'Kritisk P1 — respons 1 t, løsning 4 timer (24/7)', 60, 240, FALSE),
    ('High',            'Høj P2 — respons 2 t, løsning 8 timer (24/7)', 120, 480, FALSE),
    ('Medium',          'Mellem P3 — respons 1 hverdag, løsning 3 hverdage', 480, 4320, TRUE),
    ('Low',             'Lav P4 — respons 1 hverdag, løsning 5 hverdage', 480, 7200, TRUE)
) AS v(name, description, response_min, resolution_min, business_only)
WHERE NOT EXISTS (SELECT 1 FROM sla_policies p WHERE p.name = v.name);

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
    WHERE a.sla_policy_id = p.id
      AND a.priority = v.priority
      AND a.category_id IS NULL
      AND a.subcategory_id IS NULL
);

INSERT INTO sla_settings (id)
VALUES ('00000000-0000-4000-8000-000000000001'::uuid)
ON CONFLICT (id) DO NOTHING;
