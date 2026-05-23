-- Explicit kanban board ticket membership and custom columns (idempotent)

CREATE TABLE IF NOT EXISTS kanban_board_tickets (
    board_id UUID NOT NULL REFERENCES kanban_boards(id) ON DELETE CASCADE,
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    column_id UUID NOT NULL REFERENCES kanban_columns(id) ON DELETE CASCADE,
    position SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (board_id, ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_kanban_board_tickets_column
    ON kanban_board_tickets (board_id, column_id, position);

ALTER TABLE kanban_columns
    ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE kanban_columns
    ADD COLUMN IF NOT EXISTS wip_limit SMALLINT;

ALTER TABLE kanban_columns
    ALTER COLUMN default_status DROP NOT NULL;
