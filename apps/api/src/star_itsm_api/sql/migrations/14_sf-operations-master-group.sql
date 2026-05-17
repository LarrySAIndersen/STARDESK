-- SF Chest → SF Operations (org team); ITSM infra team → SF Infrastruktur (avoids name clash).
-- SF hovedgruppe (team SF): exactly 6 members. Safe to re-run.

-- Free team name "SF Operations" when taken by org-less ITSM infra team
UPDATE teams
SET name = 'SF Infrastruktur',
    description = 'Servere, netværk, AD, Azure',
    updated_at = NOW()
WHERE name = 'SF Operations'
  AND organization_id IS NULL
  AND EXISTS (
      SELECT 1 FROM organizations o
      WHERE o.name IN ('SF Chest', 'SF Operations')
         OR EXISTS (SELECT 1 FROM users u WHERE u.email LIKE 'sfchest%@example.dk' AND u.deleted_at IS NULL)
  )
  AND NOT EXISTS (SELECT 1 FROM teams WHERE name = 'SF Infrastruktur');

UPDATE routing_rules
SET name = REPLACE(name, 'SF Operations', 'SF Infrastruktur'),
    description = REPLACE(COALESCE(description, ''), 'SF Operations', 'SF Infrastruktur'),
    updated_at = NOW()
WHERE name LIKE '%SF Operations%'
  AND description NOT LIKE '%SF Chest%'
  AND EXISTS (SELECT 1 FROM teams WHERE name = 'SF Infrastruktur');

UPDATE routing_rules rr
SET assign_team_id = infra.id,
    updated_at = NOW()
FROM teams infra
WHERE infra.name = 'SF Infrastruktur'
  AND rr.assign_team_id IN (
      SELECT id FROM teams
      WHERE name = 'SF Infrastruktur' OR (name = 'SF Operations' AND organization_id IS NULL)
  );

-- SF Chest → SF Operations (organization + dispatch team)
UPDATE organizations
SET name = 'SF Operations',
    description = COALESCE(NULLIF(description, ''), 'SF-virksomhed'),
    is_active = TRUE,
    updated_at = NOW()
WHERE name = 'SF Chest'
  AND NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'SF Operations');

UPDATE teams
SET name = 'SF Operations',
    description = 'Gruppe SF Operations',
    is_active = TRUE,
    updated_at = NOW()
WHERE name = 'SF Chest'
  AND NOT EXISTS (SELECT 1 FROM teams WHERE name = 'SF Operations' AND organization_id IS NOT NULL);

-- Agent display names
UPDATE users
SET display_name = 'SF Operations Agent 1', updated_at = NOW()
WHERE email = 'sfchest01@example.dk' AND deleted_at IS NULL;

UPDATE users
SET display_name = 'SF Operations Agent 2', updated_at = NOW()
WHERE email = 'sfchest02@example.dk' AND deleted_at IS NULL;

UPDATE users
SET display_name = 'SF Operations Agent 3', updated_at = NOW()
WHERE email = 'sfchest03@example.dk' AND deleted_at IS NULL;

UPDATE users SET display_name = 'Anna', updated_at = NOW()
WHERE email = 'sf01@example.dk' AND deleted_at IS NULL;

UPDATE users SET display_name = 'Bo', updated_at = NOW()
WHERE email = 'sf02@example.dk' AND deleted_at IS NULL;

UPDATE users SET display_name = 'Clara', updated_at = NOW()
WHERE email = 'sf03@example.dk' AND deleted_at IS NULL;

-- SF hovedgruppe: only Larry + Anna/Bo/Clara + Operations agents 1–2
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
ON CONFLICT DO NOTHING;

UPDATE teams
SET escalation_email = 'infra@example.dk',
    updated_at = NOW()
WHERE name IN ('SF Operations', 'SF Infrastruktur') AND escalation_email IS NULL;
