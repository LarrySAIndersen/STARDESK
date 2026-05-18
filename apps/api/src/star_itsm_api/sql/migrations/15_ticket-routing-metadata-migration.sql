-- Intake answers and routing metadata (JSON) for auto-routing readiness
ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS routing_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN tickets.routing_metadata IS 'Intake answers and routing-related metadata (intake.answers, etc.)';
