-- Idempotent SF group / org renames and SF Chest deactivation.
-- Safe to re-run.

-- Core ITSM teams (init.sql)
UPDATE teams
SET name = 'SF Service Desk',
    description = 'First-line support — modtager alle nye sager',
    updated_at = NOW()
WHERE name = 'Service Desk'
  AND NOT EXISTS (SELECT 1 FROM teams WHERE name = 'SF Service Desk');

UPDATE teams
SET name = 'SF Operations',
    description = 'Servere, netværk, AD, Azure',
    updated_at = NOW()
WHERE name = 'Infrastruktur'
  AND NOT EXISTS (SELECT 1 FROM teams WHERE name = 'SF Operations');

INSERT INTO teams (name, description, is_active, organization_id)
SELECT
    'SF AI Operations',
    'AI-drift og automatisering',
    TRUE,
    NULL
WHERE NOT EXISTS (SELECT 1 FROM teams WHERE name = 'SF AI Operations');

-- Virksomhed: Es Trifft → Virksomhed
UPDATE organizations
SET name = 'Virksomhed',
    description = COALESCE(description, 'SF-virksomhed'),
    updated_at = NOW()
WHERE name = 'Es Trifft'
  AND NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'Virksomhed');

UPDATE teams
SET name = 'Virksomhed',
    description = 'Gruppe Virksomhed',
    updated_at = NOW()
WHERE name = 'Es Trifft'
  AND NOT EXISTS (SELECT 1 FROM teams WHERE name = 'Virksomhed');

-- North Star
UPDATE organizations
SET name = 'North Star',
    description = COALESCE(description, 'SF-virksomhed — North Star'),
    updated_at = NOW()
WHERE name = 'SF A North Star Series'
  AND NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'North Star');

UPDATE teams
SET name = 'North Star',
    description = 'Gruppe North Star',
    updated_at = NOW()
WHERE name = 'SF A North Star Series'
  AND NOT EXISTS (SELECT 1 FROM teams WHERE name = 'North Star');

-- SF Chest: deactivate group, reassign open tickets to SF
UPDATE tickets
SET assigned_team_id = (SELECT id FROM teams WHERE name = 'SF' AND is_active LIMIT 1),
    updated_at = NOW()
WHERE assigned_team_id IN (SELECT id FROM teams WHERE name = 'SF Chest')
  AND deleted_at IS NULL;

UPDATE routing_rules
SET assign_team_id = (SELECT id FROM teams WHERE name = 'SF' AND is_active LIMIT 1),
    updated_at = NOW()
WHERE assign_team_id IN (SELECT id FROM teams WHERE name = 'SF Chest');

DELETE FROM team_members
WHERE team_id IN (SELECT id FROM teams WHERE name = 'SF Chest');

UPDATE teams
SET is_active = FALSE,
    description = 'Deaktiveret — erstattet af SF',
    updated_at = NOW()
WHERE name = 'SF Chest';

UPDATE organizations
SET is_active = FALSE,
    updated_at = NOW()
WHERE name = 'SF Chest';

-- Routing rule labels referencing old team names
UPDATE routing_rules
SET name = REPLACE(name, 'Infrastruktur', 'SF Operations'),
    description = REPLACE(COALESCE(description, ''), 'Infrastruktur', 'SF Operations'),
    updated_at = NOW()
WHERE name LIKE '%Infrastruktur%' OR description LIKE '%Infrastruktur%';

UPDATE routing_rules
SET name = REPLACE(name, 'Service Desk', 'SF Service Desk'),
    description = REPLACE(COALESCE(description, ''), 'Service Desk', 'SF Service Desk'),
    updated_at = NOW()
WHERE name LIKE '%Service Desk%' OR description LIKE '%Service Desk%';

UPDATE teams
SET escalation_email = 'servicedesk@example.dk',
    updated_at = NOW()
WHERE name = 'SF Service Desk' AND escalation_email IS NULL;

UPDATE teams
SET escalation_email = 'infra@example.dk',
    updated_at = NOW()
WHERE name = 'SF Operations' AND escalation_email IS NULL;
