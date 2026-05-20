-- Gmail email integration (org-level OAuth + ticket threading)
-- Run once in Neon SQL Editor, or rely on API startup migrations (20_email-integration.sql).

CREATE TABLE IF NOT EXISTS email_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider VARCHAR(32) NOT NULL DEFAULT 'gmail',
    connected_email VARCHAR(320),
    refresh_token_encrypted TEXT,
    last_history_id VARCHAR(64),
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_email_integrations_org UNIQUE (organization_id)
);

CREATE INDEX IF NOT EXISTS idx_email_integrations_org
    ON email_integrations (organization_id);

DROP TRIGGER IF EXISTS trg_email_integrations_updated ON email_integrations;
CREATE TRIGGER trg_email_integrations_updated BEFORE UPDATE ON email_integrations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS ticket_emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    gmail_thread_id VARCHAR(128) NOT NULL,
    gmail_message_id VARCHAR(128) NOT NULL,
    internet_message_id VARCHAR(512),
    direction VARCHAR(16) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    subject VARCHAR(512),
    from_email VARCHAR(320),
    to_email TEXT,
    body_text TEXT,
    received_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ticket_emails_gmail_message_id UNIQUE (gmail_message_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_emails_ticket_time
    ON ticket_emails (ticket_id, received_at ASC);

CREATE INDEX IF NOT EXISTS idx_ticket_emails_org_thread
    ON ticket_emails (organization_id, gmail_thread_id);
