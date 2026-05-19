-- SF ecosystem: reset test users, roles, groups (password Stardesk2026!)
-- SF (sf01–03) = admin, ser alle sager. Virksomheds-agenter = agent, egen org, kan videresende.
-- Run after org-migration.sql. Safe to re-run.

-- bcrypt Stardesk2026!
-- $2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC

-- Soft-delete legacy / duplicate test agents (keep submitter + larrysanders)
UPDATE users
SET deleted_at = NOW(), updated_at = NOW()
WHERE deleted_at IS NULL
  AND email NOT IN (
    'submitter@example.dk',
    'larrysanders@example.dk',
    'sf01@example.dk',
    'sf02@example.dk',
    'sf03@example.dk',
    'estrifft01@example.dk',
    'estrifft02@example.dk',
    'estrifft03@example.dk',
    'northstar01@example.dk',
    'northstar02@example.dk',
    'northstar03@example.dk',
    'jobflow01@example.dk',
    'jobflow02@example.dk',
    'jobflow03@example.dk',
    'sirius01@example.dk',
    'sirius02@example.dk',
    'sirius03@example.dk',
    'bi01@example.dk',
    'bi02@example.dk',
    'bi03@example.dk',
    'sfchest01@example.dk',
    'sfchest02@example.dk',
    'sfchest03@example.dk'
  );

-- SF hovedgruppe (ingen organisation — fælles dispatch)
INSERT INTO teams (id, name, description, is_active, organization_id) VALUES (
    'a1000001-0000-4000-8000-000000000001',
    'SF',
    'Hovedgruppe — SF-admins og videresendelse på tværs af virksomheder',
    TRUE,
    NULL
)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    is_active = TRUE,
    organization_id = NULL;

-- Virksomheder (navn er nøgle — undgår id-kollision med ældre seed)
INSERT INTO organizations (name, description, is_active) VALUES
    ('Virksomhed', 'SF-virksomhed', TRUE),
    ('North Star', 'SF-virksomhed — North Star', TRUE),
    ('SF Operations', 'SF-virksomhed', TRUE),
    ('Jobflow', 'SF-virksomhed', TRUE),
    ('Sirius', 'SF-virksomhed', TRUE),
    ('BI', 'SF-virksomhed', TRUE)
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, is_active = TRUE;

INSERT INTO teams (name, description, is_active, organization_id) VALUES
    ('Virksomhed', 'Gruppe Virksomhed', TRUE, (SELECT id FROM organizations WHERE name = 'Virksomhed')),
    ('North Star', 'Gruppe North Star', TRUE, (SELECT id FROM organizations WHERE name = 'North Star')),
    ('SF Operations', 'Gruppe SF Operations', TRUE, (SELECT id FROM organizations WHERE name = 'SF Operations')),
    ('SF AI Operations', 'AI-drift og automatisering', TRUE, NULL),
    ('Jobflow', 'Gruppe Jobflow', TRUE, (SELECT id FROM organizations WHERE name = 'Jobflow')),
    ('Sirius', 'Gruppe Sirius', TRUE, (SELECT id FROM organizations WHERE name = 'Sirius')),
    ('BI', 'Gruppe BI', TRUE, (SELECT id FROM organizations WHERE name = 'BI'))
ON CONFLICT (name) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    description = EXCLUDED.description,
    is_active = TRUE;

-- SF admins (fuld adgang, ingen organisation)
INSERT INTO users (email, display_name, role, is_active, password_hash, organization_id) VALUES
    ('sf01@example.dk', 'Anna', 'top_admin', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', NULL),
    ('sf02@example.dk', 'Bo', 'admin', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', NULL),
    ('sf03@example.dk', 'Clara', 'admin', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', NULL)
ON CONFLICT (email) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    organization_id = NULL,
    password_hash = EXCLUDED.password_hash,
    is_active = TRUE,
    must_change_password = TRUE,
    deleted_at = NULL;

-- Virksomheds-agenter (ikke admin)
INSERT INTO users (email, display_name, role, is_active, password_hash, organization_id) VALUES
    ('estrifft01@example.dk', 'Virksomhed Agent 1', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', (SELECT id FROM organizations WHERE name = 'Virksomhed')),
    ('estrifft02@example.dk', 'Virksomhed Agent 2', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', (SELECT id FROM organizations WHERE name = 'Virksomhed')),
    ('estrifft03@example.dk', 'Virksomhed Agent 3', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', (SELECT id FROM organizations WHERE name = 'Virksomhed')),
    ('northstar01@example.dk', 'North Star Agent 1', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', (SELECT id FROM organizations WHERE name = 'North Star')),
    ('northstar02@example.dk', 'North Star Agent 2', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', (SELECT id FROM organizations WHERE name = 'North Star')),
    ('northstar03@example.dk', 'North Star Agent 3', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', (SELECT id FROM organizations WHERE name = 'North Star')),
    ('jobflow01@example.dk', 'Jobflow Agent 1', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', (SELECT id FROM organizations WHERE name = 'Jobflow')),
    ('jobflow02@example.dk', 'Jobflow Agent 2', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', (SELECT id FROM organizations WHERE name = 'Jobflow')),
    ('jobflow03@example.dk', 'Jobflow Agent 3', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', (SELECT id FROM organizations WHERE name = 'Jobflow')),
    ('sirius01@example.dk', 'Sirius Agent 1', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', (SELECT id FROM organizations WHERE name = 'Sirius')),
    ('sirius02@example.dk', 'Sirius Agent 2', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', (SELECT id FROM organizations WHERE name = 'Sirius')),
    ('sirius03@example.dk', 'Sirius Agent 3', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', (SELECT id FROM organizations WHERE name = 'Sirius')),
    ('bi01@example.dk', 'BI Agent 1', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', (SELECT id FROM organizations WHERE name = 'BI')),
    ('bi02@example.dk', 'BI Agent 2', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', (SELECT id FROM organizations WHERE name = 'BI')),
    ('bi03@example.dk', 'BI Agent 3', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', (SELECT id FROM organizations WHERE name = 'BI')),
    ('sfchest01@example.dk', 'SF Operations Agent 1', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', (SELECT id FROM organizations WHERE name = 'SF Operations')),
    ('sfchest02@example.dk', 'SF Operations Agent 2', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', (SELECT id FROM organizations WHERE name = 'SF Operations')),
    ('sfchest03@example.dk', 'SF Operations Agent 3', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', (SELECT id FROM organizations WHERE name = 'SF Operations'))
ON CONFLICT (email) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = 'agent',
    organization_id = EXCLUDED.organization_id,
    password_hash = EXCLUDED.password_hash,
    is_active = TRUE,
    must_change_password = TRUE,
    deleted_at = NULL;

-- Ryd medlemskaber for aktive SF-brugere og genopbyg
DELETE FROM team_members
WHERE user_id IN (
    SELECT id FROM users
    WHERE deleted_at IS NULL
      AND role IN ('agent', 'admin', 'top_admin')
      AND email LIKE '%@example.dk'
);

-- SF hovedgruppe: kun Larry, Anna/Bo/Clara og SF Operations agent 1–2
INSERT INTO team_members (team_id, user_id, joined_at)
SELECT t.id, u.id, NOW()
FROM users u
JOIN teams t ON t.name = 'SF'
WHERE u.deleted_at IS NULL
  AND u.email IN (
      'larrysanders@example.dk',
      'sf01@example.dk',
      'sf02@example.dk',
      'sf03@example.dk',
      'sfchest01@example.dk',
      'sfchest02@example.dk'
  )
ON CONFLICT DO NOTHING;

INSERT INTO team_members (team_id, user_id, joined_at)
SELECT t.id, u.id, NOW()
FROM users u
JOIN organizations o ON o.id = u.organization_id
JOIN teams t ON t.organization_id = o.id
WHERE u.deleted_at IS NULL AND u.role = 'agent'
ON CONFLICT DO NOTHING;

INSERT INTO routing_rules (name, description, priority_order, is_active, ticket_type, assign_team_id)
SELECT
    'Default til SF',
    'Nye incidents sendes til SF-gruppen',
    50,
    TRUE,
    'incident',
    t.id
FROM teams t
WHERE t.name = 'SF'
  AND NOT EXISTS (SELECT 1 FROM routing_rules WHERE name = 'Default til SF');

-- Admin Larry (password: password) — always ensure after ecosystem reset
INSERT INTO users (id, email, display_name, role, is_active, password_hash) VALUES
    (
        '00000000-0000-0000-0000-000000000040',
        'larrysanders@example.dk',
        'Larrysanders',
        'admin',
        TRUE,
        '$2b$12$R4g4tKPsO73abz4FuHtEXuYIwua1Rr3zsfp/N4x3R5h07rV33EzXC'
    )
ON CONFLICT (email) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    password_hash = EXCLUDED.password_hash,
    is_active = TRUE,
    deleted_at = NULL,
    updated_at = NOW();

INSERT INTO team_members (team_id, user_id, joined_at)
SELECT t.id, u.id, NOW()
FROM teams t
JOIN users u ON u.email = 'larrysanders@example.dk'
WHERE t.name = 'SF' AND u.deleted_at IS NULL
ON CONFLICT DO NOTHING;
