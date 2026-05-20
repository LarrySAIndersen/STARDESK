-- Extend tickets.source for chat intake (SF live chat / future transfers).
-- Keeps existing values; adds chat and knowledge (used by knowledge articles).

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_source_check;

ALTER TABLE tickets
    ADD CONSTRAINT tickets_source_check CHECK (
        source IN ('portal', 'email', 'api', 'phone', 'chat', 'knowledge')
    );
