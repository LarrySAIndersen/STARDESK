-- Landssupport + SPOC groups — 5 Supporter users each (admin rights via role supporter)
-- Password for all: Stardesk2026!
-- Run after auth migration + alembic 20260520_supporter (or users_role_check includes supporter)

-- bcrypt Stardesk2026!
-- $2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC

INSERT INTO teams (id, name, description, is_active) VALUES
    (
        'a1000002-0000-4000-8000-000000000001',
        'Landssupport',
        'Landssupport — national support line',
        TRUE
    ),
    (
        'a1000002-0000-4000-8000-000000000002',
        'SPOC',
        'SPOC — single point of contact',
        TRUE
    )
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

INSERT INTO users (id, email, display_name, role, is_active, password_hash, must_change_password) VALUES
    ('b1000002-0000-4000-8000-000000000001', 'landssupport01@example.dk', 'Landssupport Supporter 1', 'supporter', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', FALSE),
    ('b1000002-0000-4000-8000-000000000002', 'landssupport02@example.dk', 'Landssupport Supporter 2', 'supporter', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', FALSE),
    ('b1000002-0000-4000-8000-000000000003', 'landssupport03@example.dk', 'Landssupport Supporter 3', 'supporter', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', FALSE),
    ('b1000002-0000-4000-8000-000000000004', 'landssupport04@example.dk', 'Landssupport Supporter 4', 'supporter', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', FALSE),
    ('b1000002-0000-4000-8000-000000000005', 'landssupport05@example.dk', 'Landssupport Supporter 5', 'supporter', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', FALSE),
    ('b1000002-0000-4000-8000-000000000006', 'spoc01@example.dk', 'SPOC Supporter 1', 'supporter', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', FALSE),
    ('b1000002-0000-4000-8000-000000000007', 'spoc02@example.dk', 'SPOC Supporter 2', 'supporter', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', FALSE),
    ('b1000002-0000-4000-8000-000000000008', 'spoc03@example.dk', 'SPOC Supporter 3', 'supporter', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', FALSE),
    ('b1000002-0000-4000-8000-000000000009', 'spoc04@example.dk', 'SPOC Supporter 4', 'supporter', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', FALSE),
    ('b1000002-0000-4000-8000-000000000010', 'spoc05@example.dk', 'SPOC Supporter 5', 'supporter', TRUE, '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC', FALSE)
ON CONFLICT (email) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    password_hash = EXCLUDED.password_hash,
    must_change_password = EXCLUDED.must_change_password;

INSERT INTO team_members (team_id, user_id, joined_at)
SELECT t.id, u.id, NOW()
FROM (VALUES
    ('Landssupport', 'landssupport01@example.dk'),
    ('Landssupport', 'landssupport02@example.dk'),
    ('Landssupport', 'landssupport03@example.dk'),
    ('Landssupport', 'landssupport04@example.dk'),
    ('Landssupport', 'landssupport05@example.dk'),
    ('SPOC', 'spoc01@example.dk'),
    ('SPOC', 'spoc02@example.dk'),
    ('SPOC', 'spoc03@example.dk'),
    ('SPOC', 'spoc04@example.dk'),
    ('SPOC', 'spoc05@example.dk')
) AS m(team_name, email)
JOIN teams t ON t.name = m.team_name
JOIN users u ON u.email = m.email
ON CONFLICT (team_id, user_id) DO NOTHING;
