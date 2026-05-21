-- Larrysanders2 — Landssupport, klassisk UI only, password: password
-- Requires: supporter role migration + users.ui_mode column (alembic 20260520 + 20260521)

-- bcrypt for "password"
-- $2b$12$R4g4tKPsO73abz4FuHtEXuYIwua1Rr3zsfp/N4x3R5h07rV33EzXC

INSERT INTO users (
    id,
    email,
    display_name,
    role,
    is_active,
    password_hash,
    must_change_password,
    ui_mode
) VALUES (
    'b1000002-0000-4000-8000-000000000020',
    'larrysanders2@example.dk',
    'Larrysanders2',
    'supporter',
    TRUE,
    '$2b$12$R4g4tKPsO73abz4FuHtEXuYIwua1Rr3zsfp/N4x3R5h07rV33EzXC',
    FALSE,
    'classic'
)
ON CONFLICT (email) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    password_hash = EXCLUDED.password_hash,
    must_change_password = EXCLUDED.must_change_password,
    ui_mode = EXCLUDED.ui_mode,
    deleted_at = NULL,
    updated_at = NOW();

INSERT INTO team_members (team_id, user_id, joined_at)
SELECT t.id, u.id, NOW()
FROM teams t
JOIN users u ON u.email = 'larrysanders2@example.dk'
WHERE t.name = 'Landssupport'
ON CONFLICT (team_id, user_id) DO NOTHING;
