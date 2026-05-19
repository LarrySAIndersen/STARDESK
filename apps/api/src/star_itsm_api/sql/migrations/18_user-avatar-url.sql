-- Profile avatars (prototype) — run once in Neon
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS avatar_preset_id VARCHAR(64);
