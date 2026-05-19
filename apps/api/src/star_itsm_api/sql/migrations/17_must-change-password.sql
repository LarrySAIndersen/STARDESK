-- Forced password change on first login
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- Demo / prototype users (@example.dk) must change shared seed password on first login
UPDATE users
SET must_change_password = TRUE
WHERE deleted_at IS NULL
  AND email LIKE '%@example.dk'
  AND must_change_password = FALSE;
