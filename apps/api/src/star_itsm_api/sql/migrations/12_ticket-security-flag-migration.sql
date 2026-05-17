-- Sikkerhedssager flag — run once in Neon after prior ticket migrations

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS is_security_ticket BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_tickets_is_security
    ON tickets (is_security_ticket, status)
    WHERE deleted_at IS NULL AND is_security_ticket = TRUE;
