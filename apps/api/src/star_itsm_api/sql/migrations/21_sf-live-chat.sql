-- SF live chat: presence, sessions, messages (idempotent)

CREATE TABLE IF NOT EXISTS sf_chat_presence (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    is_online BOOLEAN NOT NULL DEFAULT FALSE,
    active_session_id UUID,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sf_chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'waiting',
    queue_rejected_at TIMESTAMPTZ,
    customer_last_typing_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sf_chat_sessions_status_check CHECK (
        status IN ('waiting', 'active', 'closed', 'rejected_queue')
    )
);

CREATE INDEX IF NOT EXISTS idx_sf_chat_sessions_customer_status
    ON sf_chat_sessions (customer_user_id, status);

CREATE INDEX IF NOT EXISTS idx_sf_chat_sessions_status_created
    ON sf_chat_sessions (status, created_at);

CREATE TABLE IF NOT EXISTS sf_chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sf_chat_sessions(id) ON DELETE CASCADE,
    sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sf_chat_messages_session_created
    ON sf_chat_messages (session_id, created_at);

ALTER TABLE sf_chat_presence
    DROP CONSTRAINT IF EXISTS sf_chat_presence_active_session_fkey;

ALTER TABLE sf_chat_presence
    ADD CONSTRAINT sf_chat_presence_active_session_fkey
    FOREIGN KEY (active_session_id) REFERENCES sf_chat_sessions(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS trg_sf_chat_presence_updated ON sf_chat_presence;
CREATE TRIGGER trg_sf_chat_presence_updated BEFORE UPDATE ON sf_chat_presence
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_sf_chat_sessions_updated ON sf_chat_sessions;
CREATE TRIGGER trg_sf_chat_sessions_updated BEFORE UPDATE ON sf_chat_sessions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
