-- CMDB catalog persistence + admin audit trail (searchable, paginated by size).

CREATE TABLE IF NOT EXISTS cmdb_catalog (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO cmdb_catalog (id, payload)
VALUES (1, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS cmdb_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_display_name TEXT NOT NULL DEFAULT 'Ukendt',
    action VARCHAR(32) NOT NULL,
    entity_type VARCHAR(16) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    entity_label TEXT NOT NULL DEFAULT '',
    changes JSONB NOT NULL DEFAULT '{}'::jsonb,
    summary_da TEXT NOT NULL DEFAULT '',
    search_text TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_cmdb_audit_created_at
    ON cmdb_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cmdb_audit_entity_id
    ON cmdb_audit_log (entity_id);

CREATE INDEX IF NOT EXISTS idx_cmdb_audit_action
    ON cmdb_audit_log (action);

CREATE INDEX IF NOT EXISTS idx_cmdb_audit_search_text
    ON cmdb_audit_log (search_text);
