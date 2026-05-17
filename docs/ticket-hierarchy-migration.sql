-- Parent/child tickets (store sag / små sager) + related store links — run once in Neon

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
