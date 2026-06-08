-- Personal notes: idempotent schema sync when Alembic migrations were not applied on staging.
CREATE TABLE IF NOT EXISTS personal_notes (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(256) NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    color VARCHAR(32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_personal_notes_user_id ON personal_notes(user_id);

ALTER TABLE personal_notes ADD COLUMN IF NOT EXISTS category VARCHAR(32);
ALTER TABLE personal_notes ADD COLUMN IF NOT EXISTS ticket_id UUID;
ALTER TABLE personal_notes ADD COLUMN IF NOT EXISTS visibility VARCHAR(16) NOT NULL DEFAULT 'private';
ALTER TABLE personal_notes ADD COLUMN IF NOT EXISTS note_number VARCHAR(32);
ALTER TABLE personal_notes ADD COLUMN IF NOT EXISTS board_x DOUBLE PRECISION;
ALTER TABLE personal_notes ADD COLUMN IF NOT EXISTS board_y DOUBLE PRECISION;

WITH numbered AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY EXTRACT(YEAR FROM COALESCE(created_at, NOW()))
            ORDER BY created_at ASC, id ASC
        ) AS rn,
        EXTRACT(YEAR FROM COALESCE(created_at, NOW()))::int AS yr
    FROM personal_notes
    WHERE note_number IS NULL AND deleted_at IS NULL
)
UPDATE personal_notes AS pn
SET note_number = 'IDE-' || numbered.yr::text || '-' || LPAD(numbered.rn::text, 5, '0')
FROM numbered
WHERE pn.id = numbered.id;

CREATE UNIQUE INDEX IF NOT EXISTS ix_personal_notes_note_number ON personal_notes(note_number);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_personal_notes_ticket_id'
    ) THEN
        ALTER TABLE personal_notes
            ADD CONSTRAINT fk_personal_notes_ticket_id
            FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_personal_notes_ticket_id ON personal_notes(ticket_id);