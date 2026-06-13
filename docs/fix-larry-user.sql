-- Restore / upsert Larry Sanders admin (password: Stardesk2026!)
-- Run in Neon when larrysanders@example.dk cannot log in.
-- bcrypt pepper hash (example-dk-v1): $2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC

INSERT INTO users (id, email, display_name, role, is_active, password_hash) VALUES
    (
        '00000000-0000-0000-0000-000000000040',
        'larrysanders@example.dk',
        'Larrysanders',
        'admin',
        TRUE,
        '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC'
    )
ON CONFLICT (email) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    password_hash = EXCLUDED.password_hash,
    is_active = TRUE,
    deleted_at = NULL,
    updated_at = NOW();
