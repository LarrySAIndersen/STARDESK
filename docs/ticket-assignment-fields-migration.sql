-- Årsag og fejlviseret ved tildeling til gruppe

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS assignment_reason TEXT,
    ADD COLUMN IF NOT EXISTS fault_displayed BOOLEAN NOT NULL DEFAULT FALSE;
