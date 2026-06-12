-- Per-user workspace landing layout (Eget space / Team space widgets) — idempotent

CREATE TABLE IF NOT EXISTS user_workspace_layouts (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    layout JSONB NOT NULL DEFAULT '{"personal":[],"team":[]}'::jsonb,
    layout_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_workspace_layouts_version_check CHECK (layout_version >= 1)
);

CREATE INDEX IF NOT EXISTS idx_user_workspace_layouts_updated
    ON user_workspace_layouts (updated_at DESC);

COMMENT ON TABLE user_workspace_layouts IS
    'Personal and team widget layout for workspace landing (/ and /sitemap).';
COMMENT ON COLUMN user_workspace_layouts.layout IS
    'JSON: { personal: WorkspaceWidgetInstance[], team: WorkspaceWidgetInstance[] }';
COMMENT ON COLUMN user_workspace_layouts.layout_version IS
    'Schema version for forward-compatible layout migrations.';
