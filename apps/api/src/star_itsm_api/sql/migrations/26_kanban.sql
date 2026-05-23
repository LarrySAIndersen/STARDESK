-- Kanban boards, members, and status-mapped columns (idempotent)

CREATE TABLE IF NOT EXISTS kanban_boards (
    id UUID PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_kanban_boards_team
    ON kanban_boards (team_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_boards_creator
    ON kanban_boards (created_by_user_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS kanban_board_members (
    board_id UUID NOT NULL REFERENCES kanban_boards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (board_id, user_id),
    CONSTRAINT kanban_board_members_role_check
        CHECK (role IN ('owner', 'editor', 'viewer'))
);

CREATE INDEX IF NOT EXISTS idx_kanban_board_members_user
    ON kanban_board_members (user_id);

CREATE TABLE IF NOT EXISTS kanban_columns (
    id UUID PRIMARY KEY,
    board_id UUID NOT NULL REFERENCES kanban_boards(id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL,
    position SMALLINT NOT NULL,
    statuses TEXT[] NOT NULL,
    default_status VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kanban_columns_board
    ON kanban_columns (board_id, position);
