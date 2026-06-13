-- Fix prototype login on Neon (run on **main** for production and **test** for staging).
-- Password for all @example.dk demo users: Stardesk2026!
-- Pepper hash (example-dk-v1): see migration 36_larrysanders-prototype-account.sql

-- 0) User columns required by SQLAlchemy User model (prod may lack these if Alembic never ran)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_policy_exempt BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_preset_id VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS ui_mode VARCHAR(16);

-- 1) Login throttle table (prod 500 root cause when missing)
CREATE TABLE IF NOT EXISTS login_throttle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope VARCHAR(16) NOT NULL,
    throttle_key VARCHAR(255) NOT NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_until TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_login_throttle_scope_key UNIQUE (scope, throttle_key)
);

CREATE INDEX IF NOT EXISTS ix_login_throttle_scope_key
    ON login_throttle (scope, throttle_key);

-- 2) Reset all @example.dk demo password hashes
UPDATE users
SET password_hash = '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC',
    is_active = TRUE,
    deleted_at = NULL,
    must_change_password = FALSE,
    password_policy_exempt = TRUE,
    updated_at = NOW()
WHERE email LIKE '%@example.dk';

-- 3) Ensure Benny exists (was missing in seed)
INSERT INTO users (
    id, email, display_name, role, is_active, password_hash,
    must_change_password, password_policy_exempt, ui_mode
) VALUES (
    gen_random_uuid(),
    'benny.andersen@example.dk',
    'Benny Andersen',
    'admin',
    TRUE,
    '$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC',
    FALSE,
    TRUE,
    'modern'
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    is_active = TRUE,
    deleted_at = NULL,
    must_change_password = FALSE,
    password_policy_exempt = TRUE,
    updated_at = NOW();

-- 4) Clear demo lockouts after failed attempts
DELETE FROM login_throttle
WHERE throttle_key LIKE '%@example.dk';
