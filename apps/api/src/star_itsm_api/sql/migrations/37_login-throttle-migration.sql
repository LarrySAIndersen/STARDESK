-- Login rate limiting and account lockout (FINDING-101)

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
