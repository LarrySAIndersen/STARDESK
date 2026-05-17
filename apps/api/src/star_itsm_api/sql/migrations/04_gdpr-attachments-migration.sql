-- GDPR + CPR + virus scan on attachments — run once in Neon

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS gdpr_consent BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS gdpr_consent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS subject_cpr VARCHAR(11);

ALTER TABLE attachments
    ADD COLUMN IF NOT EXISTS scan_status VARCHAR(32) NOT NULL DEFAULT 'pending'
        CHECK (scan_status IN ('pending', 'scanning', 'clean', 'infected', 'failed')),
    ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS scan_detail TEXT,
    ADD COLUMN IF NOT EXISTS visible_to_submitter BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_attachments_scan_status
    ON attachments (scan_status) WHERE scan_status IN ('pending', 'scanning');
