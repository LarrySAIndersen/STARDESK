-- SF groups + 15 test agents — password for all: Stardesk2026!
-- Run after auth-migration.sql and seed-users.sql (or standalone on Neon)

-- bcrypt for Stardesk2026!
-- $2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC

INSERT INTO teams (id, name, description, is_active) VALUES
    (
        'a1000001-0000-4000-8000-000000000001',
        'SF',
        'Hovedgruppe for SF-virksomheder: Es Trifft, SF Operations, SF A North Star Series og Jobflow',
        TRUE
    ),
    (
        'a1000001-0000-4000-8000-000000000002',
        'Es Trifft',
        'Es Trifft — SF-gruppe',
        TRUE
    ),
    (
        'a1000001-0000-4000-8000-000000000003',
        'SF Operations',
        'SF Operations — SF-gruppe',
        TRUE
    ),
    (
        'a1000001-0000-4000-8000-000000000004',
        'SF A North Star Series',
        'SF A North Star Series — SF-gruppe',
        TRUE
    ),
    (
        'a1000001-0000-4000-8000-000000000005',
        'Jobflow',
        'Jobflow — intern SF-gruppe',
        TRUE
    )
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

INSERT INTO users (id, email, display_name, role, is_active, password_hash) VALUES
    ('b1000001-0000-4000-8000-000000000001', 'sf01@example.dk', 'SF Agent Anna', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC'),
    ('b1000001-0000-4000-8000-000000000002', 'sf02@example.dk', 'SF Agent Bo', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC'),
    ('b1000001-0000-4000-8000-000000000003', 'sf03@example.dk', 'SF Agent Clara', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC'),
    ('b1000001-0000-4000-8000-000000000004', 'estrifft01@example.dk', 'Es Trifft Agent Dorte', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC'),
    ('b1000001-0000-4000-8000-000000000005', 'estrifft02@example.dk', 'Es Trifft Agent Erik', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC'),
    ('b1000001-0000-4000-8000-000000000006', 'estrifft03@example.dk', 'Es Trifft Agent Freja', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC'),
    ('b1000001-0000-4000-8000-000000000007', 'sfchest01@example.dk', 'SF Operations Agent 1', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC'),
    ('b1000001-0000-4000-8000-000000000008', 'sfchest02@example.dk', 'SF Operations Agent 2', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC'),
    ('b1000001-0000-4000-8000-000000000009', 'sfchest03@example.dk', 'SF Operations Agent 3', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC'),
    ('b1000001-0000-4000-8000-000000000010', 'northstar01@example.dk', 'North Star Agent Julie', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC'),
    ('b1000001-0000-4000-8000-000000000011', 'northstar02@example.dk', 'North Star Agent Kim', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC'),
    ('b1000001-0000-4000-8000-000000000012', 'northstar03@example.dk', 'North Star Agent Lars', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC'),
    ('b1000001-0000-4000-8000-000000000013', 'jobflow01@example.dk', 'Jobflow Agent Mette', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC'),
    ('b1000001-0000-4000-8000-000000000014', 'jobflow02@example.dk', 'Jobflow Agent Niels', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC'),
    ('b1000001-0000-4000-8000-000000000015', 'jobflow03@example.dk', 'Jobflow Agent Olivia', 'agent', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC')
ON CONFLICT (email) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    password_hash = EXCLUDED.password_hash;

INSERT INTO team_members (team_id, user_id, joined_at) VALUES
    ('a1000001-0000-4000-8000-000000000001', 'b1000001-0000-4000-8000-000000000001', NOW()),
    ('a1000001-0000-4000-8000-000000000001', 'b1000001-0000-4000-8000-000000000002', NOW()),
    ('a1000001-0000-4000-8000-000000000001', 'b1000001-0000-4000-8000-000000000003', NOW()),
    ('a1000001-0000-4000-8000-000000000002', 'b1000001-0000-4000-8000-000000000004', NOW()),
    ('a1000001-0000-4000-8000-000000000002', 'b1000001-0000-4000-8000-000000000005', NOW()),
    ('a1000001-0000-4000-8000-000000000002', 'b1000001-0000-4000-8000-000000000006', NOW()),
    ('a1000001-0000-4000-8000-000000000003', 'b1000001-0000-4000-8000-000000000007', NOW()),
    ('a1000001-0000-4000-8000-000000000003', 'b1000001-0000-4000-8000-000000000008', NOW()),
    ('a1000001-0000-4000-8000-000000000003', 'b1000001-0000-4000-8000-000000000009', NOW()),
    ('a1000001-0000-4000-8000-000000000004', 'b1000001-0000-4000-8000-000000000010', NOW()),
    ('a1000001-0000-4000-8000-000000000004', 'b1000001-0000-4000-8000-000000000011', NOW()),
    ('a1000001-0000-4000-8000-000000000004', 'b1000001-0000-4000-8000-000000000012', NOW()),
    ('a1000001-0000-4000-8000-000000000005', 'b1000001-0000-4000-8000-000000000013', NOW()),
    ('a1000001-0000-4000-8000-000000000005', 'b1000001-0000-4000-8000-000000000014', NOW()),
    ('a1000001-0000-4000-8000-000000000005', 'b1000001-0000-4000-8000-000000000015', NOW()),
    ('a1000001-0000-4000-8000-000000000001', 'b1000001-0000-4000-8000-000000000004', NOW()),
    ('a1000001-0000-4000-8000-000000000001', 'b1000001-0000-4000-8000-000000000005', NOW()),
    ('a1000001-0000-4000-8000-000000000001', 'b1000001-0000-4000-8000-000000000006', NOW()),
    ('a1000001-0000-4000-8000-000000000001', 'b1000001-0000-4000-8000-000000000007', NOW()),
    ('a1000001-0000-4000-8000-000000000001', 'b1000001-0000-4000-8000-000000000008', NOW()),
    ('a1000001-0000-4000-8000-000000000001', 'b1000001-0000-4000-8000-000000000009', NOW()),
    ('a1000001-0000-4000-8000-000000000001', 'b1000001-0000-4000-8000-000000000010', NOW()),
    ('a1000001-0000-4000-8000-000000000001', 'b1000001-0000-4000-8000-000000000011', NOW()),
    ('a1000001-0000-4000-8000-000000000001', 'b1000001-0000-4000-8000-000000000012', NOW()),
    ('a1000001-0000-4000-8000-000000000001', 'b1000001-0000-4000-8000-000000000013', NOW()),
    ('a1000001-0000-4000-8000-000000000001', 'b1000001-0000-4000-8000-000000000014', NOW()),
    ('a1000001-0000-4000-8000-000000000001', 'b1000001-0000-4000-8000-000000000015', NOW())
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
    'a1000001-0000-4000-8000-000000000001'
WHERE NOT EXISTS (
    SELECT 1 FROM routing_rules WHERE name = 'Default til SF'
);
