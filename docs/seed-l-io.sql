-- Prototype admin l@i.o (password: password)
INSERT INTO users (
    id,
    email,
    display_name,
    role,
    is_active,
    password_hash,
    password_policy_exempt,
    must_change_password,
    organization_id
) VALUES (
    '00000000-0000-0000-0000-000000000041',
    'l@i.o',
    'L IO',
    'admin',
    TRUE,
    '$2b$12$R4g4tKPsO73abz4FuHtEXuYIwua1Rr3zsfp/N4x3R5h07rV33EzXC',
    TRUE,
    FALSE,
    (SELECT id FROM organizations WHERE name = 'SF Operations' LIMIT 1)
)
ON CONFLICT (email) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    password_hash = EXCLUDED.password_hash,
    is_active = EXCLUDED.is_active,
    password_policy_exempt = EXCLUDED.password_policy_exempt,
    must_change_password = EXCLUDED.must_change_password,
    organization_id = COALESCE(
        users.organization_id,
        (SELECT id FROM organizations WHERE name = 'SF Operations' LIMIT 1)
    ),
    deleted_at = NULL,
    updated_at = NOW();
