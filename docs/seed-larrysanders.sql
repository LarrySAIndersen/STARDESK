-- Admin user Larrysanders (password: password)
-- organization_id: SF Operations (integration scoping; API also resolves for NULL org admins)
INSERT INTO users (
    id,
    email,
    display_name,
    role,
    is_active,
    password_hash,
    must_change_password,
    password_policy_exempt,
    ui_mode,
    organization_id
) VALUES (
    '00000000-0000-0000-0000-000000000040',
    'larrysanders@example.dk',
    'Larrysanders',
    'admin',
    TRUE,
    '$2b$12$R4g4tKPsO73abz4FuHtEXuYIwua1Rr3zsfp/N4x3R5h07rV33EzXC',
    FALSE,
    TRUE,
    'modern',
    (SELECT id FROM organizations WHERE name = 'SF Operations' LIMIT 1)
)
ON CONFLICT (email) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    password_hash = EXCLUDED.password_hash,
    is_active = EXCLUDED.is_active,
    must_change_password = FALSE,
    password_policy_exempt = TRUE,
    ui_mode = COALESCE(users.ui_mode, EXCLUDED.ui_mode),
    organization_id = COALESCE(
        users.organization_id,
        (SELECT id FROM organizations WHERE name = 'SF Operations' LIMIT 1)
    ),
    deleted_at = NULL,
    updated_at = NOW();
