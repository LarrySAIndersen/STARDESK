-- Optional screenshot for page review notes (Stardesk Reviewer) — idempotent

ALTER TABLE page_review_notes
    ADD COLUMN IF NOT EXISTS screenshot_storage_key VARCHAR(1024);

COMMENT ON COLUMN page_review_notes.screenshot_storage_key IS
    'Local path or blob: URL for PNG screenshot captured when the note was submitted.';
