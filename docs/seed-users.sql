-- Demo users — password for all: Stardesk2026!
-- Roles: end_user (submitter), agent (service desk), admin
-- Run after auth-migration.sql

INSERT INTO users (id, email, display_name, role, is_active, password_hash) VALUES
    (
        '00000000-0000-0000-0000-000000000010',
        'submitter@example.dk',
        'Anders Submitter',
        'end_user',
        TRUE,
        '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC'
    ),
    (
        '00000000-0000-0000-0000-000000000020',
        'agent@example.dk',
        'Mette Service Desk',
        'agent',
        TRUE,
        '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC'
    ),
    (
        '00000000-0000-0000-0000-000000000030',
        'admin@example.dk',
        'Admin Bruger',
        'admin',
        TRUE,
        '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC'
    ),
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
    is_active = EXCLUDED.is_active,
    deleted_at = NULL,
    updated_at = NOW();
