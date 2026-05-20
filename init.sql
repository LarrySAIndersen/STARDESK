-- =====================================================================
-- star-itsm-cloud — Initial database schema (for Neon Postgres)
-- =====================================================================
-- Kør dette i Neon SQL Editor én gang for at oprette schemaet.
-- Alle videre ændringer skal gå via Alembic migrations i apps/api/.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Users & Teams
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    display_name    VARCHAR(255) NOT NULL,
    role            VARCHAR(32) NOT NULL DEFAULT 'end_user'
                    CHECK (role IN ('end_user', 'agent', 'admin')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    external_id     VARCHAR(128),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_users_email ON users (email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users (role) WHERE deleted_at IS NULL;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE teams (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(128) NOT NULL UNIQUE,
    description     TEXT,
    escalation_email VARCHAR(255),
    lead_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_teams_updated BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE team_members (
    team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (team_id, user_id)
);
CREATE INDEX idx_team_members_user ON team_members (user_id);

-- Categories
CREATE TABLE categories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(128) NOT NULL UNIQUE,
    name_da         VARCHAR(128) NOT NULL,
    description     TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE subcategories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id     UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name            VARCHAR(128) NOT NULL,
    name_da         VARCHAR(128) NOT NULL,
    description     TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (category_id, name)
);
CREATE INDEX idx_subcategories_category ON subcategories (category_id);
CREATE TRIGGER trg_subcategories_updated BEFORE UPDATE ON subcategories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- SLA Policies
CREATE TABLE sla_policies (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                    VARCHAR(128) NOT NULL UNIQUE,
    description             TEXT,
    response_time_minutes   INTEGER NOT NULL,
    resolution_time_minutes INTEGER NOT NULL,
    business_hours_only     BOOLEAN NOT NULL DEFAULT TRUE,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_sla_policies_updated BEFORE UPDATE ON sla_policies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE sla_assignments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sla_policy_id   UUID NOT NULL REFERENCES sla_policies(id) ON DELETE RESTRICT,
    priority        VARCHAR(16) NOT NULL
                    CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    category_id     UUID REFERENCES categories(id) ON DELETE CASCADE,
    subcategory_id  UUID REFERENCES subcategories(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sla_assignments_lookup
    ON sla_assignments (priority, category_id, subcategory_id);

-- Routing Rules
CREATE TABLE routing_rules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(128) NOT NULL,
    description     TEXT,
    priority_order  INTEGER NOT NULL DEFAULT 100,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    ticket_type     VARCHAR(32)
                    CHECK (ticket_type IN ('service_request', 'incident', 'problem')),
    category_id     UUID REFERENCES categories(id) ON DELETE CASCADE,
    subcategory_id  UUID REFERENCES subcategories(id) ON DELETE CASCADE,
    min_priority    VARCHAR(16)
                    CHECK (min_priority IN ('critical', 'high', 'medium', 'low')),
    assign_team_id  UUID REFERENCES teams(id) ON DELETE SET NULL,
    assign_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    set_priority    VARCHAR(16)
                    CHECK (set_priority IN ('critical', 'high', 'medium', 'low')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_routing_rules_eval
    ON routing_rules (is_active, priority_order)
    WHERE is_active = TRUE;
CREATE TRIGGER trg_routing_rules_updated BEFORE UPDATE ON routing_rules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Tickets
CREATE TABLE tickets (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number               VARCHAR(32) NOT NULL UNIQUE,
    ticket_type                 VARCHAR(32) NOT NULL
                                CHECK (ticket_type IN ('service_request', 'incident', 'problem')),
    title                       VARCHAR(256) NOT NULL,
    description                 TEXT NOT NULL,
    status                      VARCHAR(32) NOT NULL DEFAULT 'new'
                                CHECK (status IN (
                                    'new', 'assigned', 'in_progress',
                                    'on_hold', 'resolved', 'closed', 'cancelled'
                                )),
    priority                    VARCHAR(16) NOT NULL DEFAULT 'medium'
                                CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    reporter_user_id            UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_team_id            UUID REFERENCES teams(id) ON DELETE SET NULL,
    assigned_user_id            UUID REFERENCES users(id) ON DELETE SET NULL,
    category_id                 UUID REFERENCES categories(id) ON DELETE RESTRICT,
    subcategory_id              UUID REFERENCES subcategories(id) ON DELETE RESTRICT,
    source                      VARCHAR(32) NOT NULL DEFAULT 'portal'
                                CHECK (source IN ('portal', 'email', 'api', 'phone', 'chat', 'knowledge')),
    source_email_message_id     VARCHAR(512),
    sla_policy_id               UUID REFERENCES sla_policies(id) ON DELETE SET NULL,
    response_due_at             TIMESTAMPTZ,
    resolution_due_at           TIMESTAMPTZ,
    first_response_at           TIMESTAMPTZ,
    resolved_at                 TIMESTAMPTZ,
    closed_at                   TIMESTAMPTZ,
    sla_paused_at               TIMESTAMPTZ,
    sla_pause_total_seconds     INTEGER NOT NULL DEFAULT 0,
    escalation_level            SMALLINT NOT NULL DEFAULT 0
                                CHECK (escalation_level BETWEEN 0 AND 3),
    last_escalation_at          TIMESTAMPTZ,
    root_cause                  TEXT,
    workaround                  TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at                  TIMESTAMPTZ,
    description_embedding       VECTOR(1024)
);

CREATE INDEX idx_tickets_status ON tickets (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tickets_assigned_team ON tickets (assigned_team_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tickets_assigned_user ON tickets (assigned_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tickets_reporter ON tickets (reporter_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tickets_type ON tickets (ticket_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_tickets_priority ON tickets (priority) WHERE deleted_at IS NULL;
CREATE INDEX idx_tickets_resolution_due
    ON tickets (resolution_due_at, escalation_level)
    WHERE status IN ('new', 'assigned', 'in_progress') AND deleted_at IS NULL;
CREATE INDEX idx_tickets_title_trgm ON tickets USING gin (title gin_trgm_ops);
CREATE INDEX idx_tickets_description_trgm ON tickets USING gin (description gin_trgm_ops);

CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Comments
CREATE TABLE ticket_comments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    author_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    body            TEXT NOT NULL,
    is_internal     BOOLEAN NOT NULL DEFAULT FALSE,
    source_email_message_id VARCHAR(512),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_comments_ticket ON ticket_comments (ticket_id, created_at)
    WHERE deleted_at IS NULL;
CREATE TRIGGER trg_comments_updated BEFORE UPDATE ON ticket_comments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Attachments
CREATE TABLE attachments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    comment_id      UUID REFERENCES ticket_comments(id) ON DELETE CASCADE,
    uploader_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    filename        VARCHAR(512) NOT NULL,
    content_type    VARCHAR(128) NOT NULL,
    size_bytes      BIGINT NOT NULL,
    storage_key     VARCHAR(512) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_attachments_ticket ON attachments (ticket_id);

-- Ticket Events (audit)
CREATE TABLE ticket_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    actor_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type      VARCHAR(64) NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_events_ticket ON ticket_events (ticket_id, created_at);
CREATE INDEX idx_events_type ON ticket_events (event_type, created_at);

-- Problem links
CREATE TABLE problem_incident_links (
    problem_ticket_id   UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    incident_ticket_id  UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    linked_by_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    linked_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (problem_ticket_id, incident_ticket_id),
    CHECK (problem_ticket_id != incident_ticket_id)
);
CREATE INDEX idx_problem_links_incident ON problem_incident_links (incident_ticket_id);

-- Email inbound log
CREATE TABLE email_inbound_log (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id          VARCHAR(512) NOT NULL UNIQUE,
    from_address        VARCHAR(320) NOT NULL,
    to_address          VARCHAR(320) NOT NULL,
    subject             VARCHAR(512),
    received_at         TIMESTAMPTZ NOT NULL,
    processed_at        TIMESTAMPTZ,
    result              VARCHAR(64),
    result_ticket_id    UUID REFERENCES tickets(id) ON DELETE SET NULL,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_email_log_received ON email_inbound_log (received_at);
CREATE INDEX idx_email_log_unprocessed ON email_inbound_log (received_at)
    WHERE processed_at IS NULL;

-- Seed data
INSERT INTO sla_policies (name, description, response_time_minutes, resolution_time_minutes, business_hours_only) VALUES
    ('Critical (24/7)', 'Kritisk P1 — respons 1 t, løsning 4 timer (24/7)', 60, 240, FALSE),
    ('High',            'Høj P2 — respons 2 t, løsning 8 timer (24/7)', 120, 480, FALSE),
    ('Medium',          'Mellem P3 — respons 1 hverdag, løsning 3 hverdage', 480, 4320, TRUE),
    ('Low',             'Lav P4 — respons 1 hverdag, løsning 5 hverdage', 480, 7200, TRUE);

INSERT INTO users (id, email, display_name, role, is_active) VALUES
    ('00000000-0000-0000-0000-000000000001', 'system@star.dk', 'System', 'admin', TRUE);

INSERT INTO teams (name, description) VALUES
    ('SF Service Desk', 'First-line support — modtager alle nye sager'),
    ('SF Infrastruktur', 'Servere, netværk, AD, Azure'),
    ('SF AI Operations', 'AI-drift og automatisering'),
    ('Applikation', 'Applikationsdrift og -support');

INSERT INTO categories (name, name_da, sort_order) VALUES
    ('hardware', 'Hardware', 10),
    ('software', 'Software', 20),
    ('access', 'Adgang og rettigheder', 30),
    ('network', 'Netværk og internet', 40),
    ('security', 'Sikkerhed', 50),
    ('email_collaboration', 'E-mail og samarbejde', 60),
    ('cloud_services', 'Cloud og SaaS', 70),
    ('telephony', 'Telefoni og møder', 80),
    ('it_support', 'IT-support generelt', 90),
    ('hr_personnel', 'HR og personale', 100),
    ('facilities', 'Faciliteter og lokaler', 110),
    ('procurement', 'Indkøb og licenser', 120),
    ('training', 'Oplæring og vejledning', 130),
    ('other', 'Andet', 999);
