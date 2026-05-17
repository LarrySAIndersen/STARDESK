-- Organizations — run once in Neon SQL Editor after init.sql
-- Enables shared ticket visibility per indmelder-organisation

CREATE TABLE IF NOT EXISTS organizations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(128) NOT NULL UNIQUE,
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_organizations_updated ON organizations;
CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_organization
    ON users (organization_id) WHERE deleted_at IS NULL;

ALTER TABLE teams
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teams_organization
    ON teams (organization_id) WHERE is_active = TRUE;

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_organization
    ON tickets (organization_id, created_at DESC) WHERE deleted_at IS NULL;

UPDATE tickets t
SET organization_id = u.organization_id
FROM users u
WHERE t.reporter_user_id = u.id
  AND t.organization_id IS NULL
  AND u.organization_id IS NOT NULL;
