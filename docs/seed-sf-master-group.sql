-- SF hovedgruppe — kun 6 medlemmer (kør efter seed-sf-ecosystem-reset.sql)

INSERT INTO teams (id, name, description, is_active) VALUES (
    'a1000001-0000-4000-8000-000000000001',
    'SF',
    'Hovedgruppe — SF-admins og udvalgte agenter til videresendelse på tværs',
    TRUE
)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    is_active = TRUE;

DELETE FROM team_members
WHERE team_id IN (SELECT id FROM teams WHERE name = 'SF');

INSERT INTO team_members (team_id, user_id, joined_at)
SELECT t.id, u.id, NOW()
FROM teams t
CROSS JOIN users u
WHERE t.name = 'SF'
  AND u.deleted_at IS NULL
  AND u.email IN (
      'larrysanders@example.dk',
      'sf01@example.dk',
      'sf02@example.dk',
      'sf03@example.dk',
      'sfchest01@example.dk',
      'sfchest02@example.dk'
  )
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
