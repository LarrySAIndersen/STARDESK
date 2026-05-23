-- Admin-controlled exemption from forced password change and complexity rules
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_policy_exempt BOOLEAN NOT NULL DEFAULT FALSE;
