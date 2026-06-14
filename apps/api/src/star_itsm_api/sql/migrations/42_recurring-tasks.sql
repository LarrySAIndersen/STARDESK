-- Recurring tasks (Wreck ind) — scheduled ticket templates

-- Expand sagstype CHECK constraints to include wreck_ind
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_ticket_type_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_ticket_type_check
    CHECK (ticket_type IN ('service_request', 'incident', 'problem', 'wreck_ind'));

ALTER TABLE routing_rules DROP CONSTRAINT IF EXISTS routing_rules_ticket_type_check;
ALTER TABLE routing_rules ADD CONSTRAINT routing_rules_ticket_type_check
    CHECK (ticket_type IN ('service_request', 'incident', 'problem', 'wreck_ind'));

ALTER TABLE sla_assignments DROP CONSTRAINT IF EXISTS sla_assignments_ticket_type_check;
ALTER TABLE sla_assignments ADD CONSTRAINT sla_assignments_ticket_type_check
    CHECK (ticket_type IS NULL OR ticket_type IN ('service_request', 'incident', 'problem', 'wreck_ind'));

CREATE TABLE IF NOT EXISTS recurring_tasks (
    id                  UUID PRIMARY KEY,
    title               VARCHAR(256) NOT NULL,
    description         TEXT NOT NULL DEFAULT '',
    priority            VARCHAR(16) NOT NULL DEFAULT 'medium'
                        CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    category_id         UUID REFERENCES categories(id) ON DELETE SET NULL,
    subcategory_id      UUID REFERENCES subcategories(id) ON DELETE SET NULL,
    assigned_team_id    UUID REFERENCES teams(id) ON DELETE SET NULL,
    assigned_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    schedule_unit       VARCHAR(16) NOT NULL
                        CHECK (schedule_unit IN ('minute', 'hour', 'day', 'week', 'month')),
    schedule_interval   INTEGER NOT NULL CHECK (schedule_interval > 0 AND schedule_interval <= 10000),
    next_run_at         TIMESTAMPTZ NOT NULL,
    last_run_at         TIMESTAMPTZ,
    last_ticket_id      UUID REFERENCES tickets(id) ON DELETE SET NULL,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_recurring_tasks_next_run
    ON recurring_tasks (next_run_at)
    WHERE deleted_at IS NULL AND is_active = TRUE;
