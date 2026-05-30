-- STARdesk: run entire script in Neon SQL Editor (idempotent)


-- === docs/auth-migration.sql ===

-- Auth: password login (run once in Neon after init.sql)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- === docs/org-migration.sql ===

-- Organizations â€” run once in Neon SQL Editor after init.sql
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

-- === docs/ticket-underaarsag-migration.sql ===

-- UnderÃ¥rsager + stor sag â€” run once in Neon after org-migration.sql

CREATE TABLE IF NOT EXISTS sub_causes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id     UUID REFERENCES categories(id) ON DELETE CASCADE,
    name            VARCHAR(128) NOT NULL,
    name_da         VARCHAR(128) NOT NULL,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (category_id, name)
);

DROP TRIGGER IF EXISTS trg_sub_causes_updated ON sub_causes;
CREATE TRIGGER trg_sub_causes_updated BEFORE UPDATE ON sub_causes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS ticket_sub_causes (
    ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    sub_cause_id    UUID NOT NULL REFERENCES sub_causes(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (ticket_id, sub_cause_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_sub_causes_ticket
    ON ticket_sub_causes (ticket_id);

CREATE INDEX IF NOT EXISTS idx_sub_causes_category
    ON sub_causes (category_id) WHERE is_active = TRUE;

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS is_major BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_tickets_is_major
    ON tickets (is_major, status) WHERE deleted_at IS NULL AND is_major = TRUE;

-- === docs/gdpr-attachments-migration.sql ===

-- GDPR + CPR + virus scan on attachments â€” run once in Neon

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS gdpr_consent BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS gdpr_consent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS subject_cpr VARCHAR(11);

ALTER TABLE attachments
    ADD COLUMN IF NOT EXISTS scan_status VARCHAR(32) NOT NULL DEFAULT 'pending'
        CHECK (scan_status IN ('pending', 'scanning', 'clean', 'infected', 'failed')),
    ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS scan_detail TEXT,
    ADD COLUMN IF NOT EXISTS visible_to_submitter BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_attachments_scan_status
    ON attachments (scan_status) WHERE scan_status IN ('pending', 'scanning');

-- === docs/ticket-activity-timestamps-migration.sql ===

-- Activity milestone timestamps on tickets â€” run once in Neon

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS in_progress_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS on_hold_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ;

-- Backfill from ticket_events where possible (optional, safe to re-run)
UPDATE tickets t
SET assigned_at = sub.occurred_at
FROM (
    SELECT ticket_id, MIN(created_at) AS occurred_at
    FROM ticket_events
    WHERE event_type IN ('ticket.assigned', 'ticket.created')
    GROUP BY ticket_id
) sub
WHERE t.id = sub.ticket_id
  AND t.assigned_at IS NULL
  AND (t.assigned_team_id IS NOT NULL OR t.assigned_user_id IS NOT NULL);

UPDATE tickets t
SET resolved_at = sub.occurred_at
FROM (
    SELECT ticket_id, MIN(created_at) AS occurred_at
    FROM ticket_events
    WHERE event_type = 'ticket.status_changed'
      AND payload->>'status' = 'resolved'
    GROUP BY ticket_id
) sub
WHERE t.id = sub.ticket_id AND t.resolved_at IS NULL;

UPDATE tickets t
SET closed_at = sub.occurred_at
FROM (
    SELECT ticket_id, MIN(created_at) AS occurred_at
    FROM ticket_events
    WHERE event_type = 'ticket.status_changed'
      AND payload->>'status' = 'closed'
    GROUP BY ticket_id
) sub
WHERE t.id = sub.ticket_id AND t.closed_at IS NULL;

-- === docs/ticket-assignment-fields-migration.sql ===

-- Ã…rsag og fejlviseret ved tildeling til gruppe

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS assignment_reason TEXT,
    ADD COLUMN IF NOT EXISTS fault_displayed BOOLEAN NOT NULL DEFAULT FALSE;

-- === docs/ticket-tags-emoji-migration.sql ===

-- Tags (searchable) + emoji label on tickets

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS emoji VARCHAR(16);

CREATE INDEX IF NOT EXISTS idx_tickets_tags_gin ON tickets USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_tickets_emoji ON tickets (emoji)
    WHERE emoji IS NOT NULL AND deleted_at IS NULL;

-- === docs/ticket-intelligence-migration.sql ===

-- Semantic + ease metadata for LLM-assisted triage (no embeddings required)
ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS semantic_topics TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS ease_score SMALLINT
        CHECK (ease_score IS NULL OR ease_score BETWEEN 1 AND 5),
    ADD COLUMN IF NOT EXISTS complexity_score SMALLINT
        CHECK (complexity_score IS NULL OR complexity_score BETWEEN 1 AND 5),
    ADD COLUMN IF NOT EXISTS llm_summary TEXT,
    ADD COLUMN IF NOT EXISTS handling_hints TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS intelligence_source VARCHAR(32)
        CHECK (
            intelligence_source IS NULL
            OR intelligence_source IN ('seed', 'heuristic', 'llm', 'manual')
        ),
    ADD COLUMN IF NOT EXISTS intelligence_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tickets_semantic_topics_gin
    ON tickets USING GIN (semantic_topics);

CREATE INDEX IF NOT EXISTS idx_tickets_ease_score
    ON tickets (ease_score)
    WHERE deleted_at IS NULL AND ease_score IS NOT NULL;

COMMENT ON COLUMN tickets.ease_score IS '1=svÃ¦r, 5=let at lÃ¸se (lethed)';
COMMENT ON COLUMN tickets.complexity_score IS '1=simpel, 5=kompleks sag';
COMMENT ON COLUMN tickets.llm_summary IS 'Kort dansk sammenfatning til LLM-prompts';
COMMENT ON COLUMN tickets.semantic_topics IS 'Normaliserede emneord til semantisk match';

-- === docs/comment-reactions-migration.sql ===

-- Emoji reactions (positive / negative) on ticket comments
CREATE TABLE IF NOT EXISTS comment_reactions (
    comment_id UUID NOT NULL REFERENCES ticket_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sentiment VARCHAR(16) NOT NULL CHECK (sentiment IN ('positive', 'negative')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment
    ON comment_reactions (comment_id);

-- === docs/ticket-hierarchy-migration.sql ===

-- Parent/child tickets (store sag / smÃ¥ sager) + related store links â€” run once in Neon

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS parent_ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_parent_ticket_id
    ON tickets (parent_ticket_id)
    WHERE deleted_at IS NULL AND parent_ticket_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ticket_links (
    from_ticket_id   UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    to_ticket_id     UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    link_type        VARCHAR(32) NOT NULL DEFAULT 'related'
                     CHECK (link_type IN ('related')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (from_ticket_id, to_ticket_id),
    CHECK (from_ticket_id <> to_ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_links_to
    ON ticket_links (to_ticket_id);

-- === docs/ticket-shared-migration.sql ===

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
    CHECK (role IN ('end_user', 'agent', 'admin', 'top_admin', 'supporter', 'stardesk_reviewer'));

-- === docs/ticket-security-flag-migration.sql ===

-- Sikkerhedssager flag â€” run once in Neon after prior ticket migrations

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS is_security_ticket BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_tickets_is_security
    ON tickets (is_security_ticket, status)
    WHERE deleted_at IS NULL AND is_security_ticket = TRUE;

-- === docs/ticket-routing-metadata-migration.sql ===

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS routing_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- === docs/must-change-password-migration.sql ===

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- Demo / prototype users (@example.dk) must change shared seed password on first login
UPDATE users
SET must_change_password = TRUE
WHERE deleted_at IS NULL
  AND email LIKE '%@example.dk'
  AND must_change_password = FALSE;

-- === docs/knowledge-articles-migration.sql ===

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS is_knowledge_article BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS knowledge_status VARCHAR(16),
    ADD COLUMN IF NOT EXISTS knowledge_visibility VARCHAR(16);

CREATE INDEX IF NOT EXISTS idx_tickets_knowledge_published
    ON tickets (knowledge_status, knowledge_visibility)
    WHERE deleted_at IS NULL AND is_knowledge_article = TRUE;

-- === docs/user-avatar-url-migration.sql ===

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS avatar_preset_id VARCHAR(64);

-- === docs/email-integration-migration.sql ===

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
