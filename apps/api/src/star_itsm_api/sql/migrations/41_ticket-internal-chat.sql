-- Internal ticket-linked chat channels (staff-only) — idempotent

ALTER TABLE team_chat_channels
    ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE;

ALTER TABLE team_chat_channel_members
    ADD COLUMN IF NOT EXISTS invited_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE team_chat_channels DROP CONSTRAINT IF EXISTS team_chat_channels_type_check;
ALTER TABLE team_chat_channels ADD CONSTRAINT team_chat_channels_type_check CHECK (
    channel_type IN ('public', 'private', 'dm', 'bot', 'ticket')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_chat_channels_ticket_unique
    ON team_chat_channels (ticket_id)
    WHERE ticket_id IS NOT NULL AND channel_type = 'ticket';

CREATE INDEX IF NOT EXISTS idx_team_chat_channels_ticket_id
    ON team_chat_channels (ticket_id)
    WHERE ticket_id IS NOT NULL;
