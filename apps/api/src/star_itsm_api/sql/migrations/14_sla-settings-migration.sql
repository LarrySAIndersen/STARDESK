-- SLA operational settings + ticket pause columns (idempotent)

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS sla_paused_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sla_pause_total_seconds INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS sla_settings (
    id                              UUID PRIMARY KEY,
    pause_on_hold                   BOOLEAN NOT NULL DEFAULT TRUE,
    pause_statuses                  VARCHAR(32)[] NOT NULL DEFAULT ARRAY['on_hold'],
    trigger_team_ids                UUID[] NOT NULL DEFAULT '{}',
    sla_starts_on_team_assignment   BOOLEAN NOT NULL DEFAULT FALSE,
    due_soon_minutes                INTEGER NOT NULL DEFAULT 60,
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO sla_settings (id)
VALUES ('00000000-0000-4000-8000-000000000001'::uuid)
ON CONFLICT (id) DO NOTHING;
