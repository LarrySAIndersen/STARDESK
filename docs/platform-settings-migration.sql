-- Platform-wide settings (e.g. sidebar nav visibility for non–top-admin users)
CREATE TABLE IF NOT EXISTS platform_settings (
    key VARCHAR(64) PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_settings (key, value)
VALUES ('sidebar_hidden_nav_ids', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;
