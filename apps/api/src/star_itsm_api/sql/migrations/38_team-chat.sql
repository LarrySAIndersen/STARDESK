-- Internal team chat (Slack-like workspace) — idempotent

CREATE TABLE IF NOT EXISTS team_chat_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    slug VARCHAR(80) NOT NULL,
    description TEXT,
    is_private BOOLEAN NOT NULL DEFAULT FALSE,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    channel_type VARCHAR(16) NOT NULL DEFAULT 'public',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT team_chat_channels_type_check CHECK (
        channel_type IN ('public', 'private', 'dm', 'bot')
    ),
    CONSTRAINT team_chat_channels_org_slug_unique UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_team_chat_channels_org
    ON team_chat_channels (organization_id);

CREATE TABLE IF NOT EXISTS team_chat_channel_members (
    channel_id UUID NOT NULL REFERENCES team_chat_channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_chat_members_user
    ON team_chat_channel_members (user_id);

CREATE TABLE IF NOT EXISTS team_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES team_chat_channels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    body TEXT NOT NULL,
    is_bot BOOLEAN NOT NULL DEFAULT FALSE,
    tool_call_meta JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_chat_messages_channel_created
    ON team_chat_messages (channel_id, created_at);

CREATE TABLE IF NOT EXISTS team_chat_message_reactions (
    message_id UUID NOT NULL REFERENCES team_chat_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_team_chat_reactions_message
    ON team_chat_message_reactions (message_id);

DROP TRIGGER IF EXISTS trg_team_chat_channels_updated ON team_chat_channels;
CREATE TRIGGER trg_team_chat_channels_updated BEFORE UPDATE ON team_chat_channels
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
