-- SF hovedgruppe + alle agenter som medlemmer (kør efter seed-orgs-30.sql)
-- Password for test agents: Stardesk2026!

INSERT INTO teams (id, name, description, is_active) VALUES (
    'a1000001-0000-4000-8000-000000000001',
    'SF',
    'Hovedgruppe — alle agenter er medlemmer og kan tildeles sager på tværs af SF-virksomheder',
    TRUE
)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    is_active = TRUE;

INSERT INTO team_members (team_id, user_id, joined_at)
SELECT t.id, u.id, NOW()
FROM teams t
CROSS JOIN users u
WHERE t.name = 'SF'
  AND u.role IN ('agent', 'admin')
  AND u.deleted_at IS NULL
ON CONFLICT (team_id, user_id) DO NOTHING;

INSERT INTO routing_rules (
    name, description, priority_order, is_active, ticket_type, assign_team_id
)
SELECT
    'Default til SF',
    'Nye incidents uden andet match sendes til SF-gruppen',
    50,
    TRUE,
    'incident',
    t.id
FROM teams t
WHERE t.name = 'SF'
  AND NOT EXISTS (
      SELECT 1 FROM routing_rules WHERE name = 'Default til SF'
  );
