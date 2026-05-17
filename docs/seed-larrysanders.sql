-- Admin user Larrysanders (password: password)
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
    is_active = EXCLUDED.is_active;
