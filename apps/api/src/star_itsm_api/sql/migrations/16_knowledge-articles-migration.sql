-- Vidensartikler (knowledge articles) — idempotent migration

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS is_knowledge_article BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS knowledge_status VARCHAR(16),
    ADD COLUMN IF NOT EXISTS knowledge_visibility VARCHAR(16);

CREATE INDEX IF NOT EXISTS idx_tickets_knowledge_published
    ON tickets (knowledge_status, knowledge_visibility)
    WHERE deleted_at IS NULL AND is_knowledge_article = TRUE;
