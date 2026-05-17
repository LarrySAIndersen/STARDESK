-- Underårsager + stor sag — run once in Neon after org-migration.sql

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
