-- Shared tickets (delte sager) visible to end users across organisations.
-- Rights roles: docs/demo-users-and-access.md

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_tickets_is_shared
    ON tickets (is_shared, organization_id)
    WHERE deleted_at IS NULL AND is_shared = TRUE;

-- Allow top_admin rettighedsgruppe on users
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('end_user', 'agent', 'admin', 'top_admin'));
