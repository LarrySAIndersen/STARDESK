-- Per-user UI lock: classic vs modern (sync with alembic 20260521_ui_mode)
ALTER TABLE users ADD COLUMN IF NOT EXISTS ui_mode VARCHAR(16);
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_ui_mode_check;
ALTER TABLE users ADD CONSTRAINT users_ui_mode_check
    CHECK (ui_mode IS NULL OR ui_mode IN ('modern', 'classic'));
