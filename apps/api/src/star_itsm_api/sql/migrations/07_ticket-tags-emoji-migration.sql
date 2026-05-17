-- Tags (searchable) + emoji label on tickets

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS emoji VARCHAR(16);

CREATE INDEX IF NOT EXISTS idx_tickets_tags_gin ON tickets USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_tickets_emoji ON tickets (emoji)
    WHERE emoji IS NOT NULL AND deleted_at IS NULL;
