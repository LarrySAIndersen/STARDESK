-- External vendor groups: KMD, Netcompany, Schultz
-- Removes SF Koncern (team + sfkoncern01–03 users). Jobflow stays internal (see team-categories.ts).
-- Password for all new @example.dk agents: Stardesk2026!
-- bcrypt: $2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC
-- Safe to re-run on Neon after org-migration.sql

-- ── Remove SF Koncern ────────────────────────────────────────────────────────

DELETE FROM team_members
WHERE team_id IN (SELECT id FROM teams WHERE name ILIKE 'SF Koncern');

UPDATE users
SET deleted_at = NOW(), updated_at = NOW(), is_active = FALSE
WHERE deleted_at IS NULL
  AND email IN (
    'sfkoncern01@example.dk',
    'sfkoncern02@example.dk',
    'sfkoncern03@example.dk'
  );

UPDATE teams
SET is_active = FALSE, updated_at = NOW()
WHERE name ILIKE 'SF Koncern';

UPDATE organizations
SET is_active = FALSE, updated_at = NOW()
WHERE name ILIKE 'SF Koncern';

-- ── External vendors (standalone org + team each) ─────────────────────────────

INSERT INTO organizations (id, name, description, is_active) VALUES
    ('e1000001-0000-4000-8000-000000000101', 'KMD', 'Ekstern leverandør', TRUE),
    ('e1000001-0000-4000-8000-000000000102', 'Netcompany', 'Ekstern leverandør', TRUE),
    ('e1000001-0000-4000-8000-000000000103', 'Schultz', 'Ekstern leverandør', TRUE)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    is_active = TRUE,
    updated_at = NOW();

INSERT INTO teams (name, description, is_active, organization_id) VALUES
    ('KMD', 'Ekstern leverandørgruppe — KMD', TRUE, (SELECT id FROM organizations WHERE name = 'KMD')),
    ('Netcompany', 'Ekstern leverandørgruppe — Netcompany', TRUE, (SELECT id FROM organizations WHERE name = 'Netcompany')),
    ('Schultz', 'Ekstern leverandørgruppe — Schultz', TRUE, (SELECT id FROM organizations WHERE name = 'Schultz'))
ON CONFLICT (name) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    description = EXCLUDED.description,
    is_active = TRUE,
    updated_at = NOW();

INSERT INTO users (id, email, display_name, role, is_active, password_hash, organization_id) VALUES
    ('b3000001-0000-4000-8000-000000000001', 'kmd01@example.dk', 'KMD Agent 1', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', (SELECT id FROM organizations WHERE name = 'KMD')),
    ('b3000001-0000-4000-8000-000000000002', 'kmd02@example.dk', 'KMD Agent 2', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', (SELECT id FROM organizations WHERE name = 'KMD')),
    ('b3000001-0000-4000-8000-000000000003', 'kmd03@example.dk', 'KMD Agent 3', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', (SELECT id FROM organizations WHERE name = 'KMD')),
    ('b3000001-0000-4000-8000-000000000004', 'netcompany01@example.dk', 'Netcompany Agent 1', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', (SELECT id FROM organizations WHERE name = 'Netcompany')),
    ('b3000001-0000-4000-8000-000000000005', 'netcompany02@example.dk', 'Netcompany Agent 2', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', (SELECT id FROM organizations WHERE name = 'Netcompany')),
    ('b3000001-0000-4000-8000-000000000006', 'netcompany03@example.dk', 'Netcompany Agent 3', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', (SELECT id FROM organizations WHERE name = 'Netcompany')),
    ('b3000001-0000-4000-8000-000000000007', 'schultz01@example.dk', 'Schultz Agent 1', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', (SELECT id FROM organizations WHERE name = 'Schultz')),
    ('b3000001-0000-4000-8000-000000000008', 'schultz02@example.dk', 'Schultz Agent 2', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', (SELECT id FROM organizations WHERE name = 'Schultz')),
    ('b3000001-0000-4000-8000-000000000009', 'schultz03@example.dk', 'Schultz Agent 3', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', (SELECT id FROM organizations WHERE name = 'Schultz'))
ON CONFLICT (email) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    organization_id = EXCLUDED.organization_id,
    password_hash = EXCLUDED.password_hash,
    is_active = TRUE,
    must_change_password = TRUE,
    deleted_at = NULL,
    updated_at = NOW();

INSERT INTO team_members (team_id, user_id, joined_at)
SELECT t.id, u.id, NOW()
FROM users u
JOIN organizations o ON o.id = u.organization_id
JOIN teams t ON t.organization_id = o.id AND t.name = o.name
WHERE u.deleted_at IS NULL
  AND o.name IN ('KMD', 'Netcompany', 'Schultz')
ON CONFLICT DO NOTHING;
