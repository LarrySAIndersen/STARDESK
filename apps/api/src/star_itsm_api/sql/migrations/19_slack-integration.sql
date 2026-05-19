-- Organization-level integration settings (Slack OAuth token storage)
CREATE TABLE IF NOT EXISTS organization_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider VARCHAR(64) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    slack_team_id VARCHAR(64),
    slack_team_name VARCHAR(255),
    slack_bot_token TEXT,
    default_channel_id VARCHAR(64),
    webhook_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_integrations_org_provider UNIQUE (organization_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_org_integrations_org_provider
    ON organization_integrations (organization_id, provider);

DROP TRIGGER IF EXISTS trg_organization_integrations_updated ON organization_integrations;
CREATE TRIGGER trg_organization_integrations_updated BEFORE UPDATE ON organization_integrations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
