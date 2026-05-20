-- SF chat: Sag-assistent (chat service bot) while waiting in queue

ALTER TABLE sf_chat_sessions
    ADD COLUMN IF NOT EXISTS bot_assistant_active BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE sf_chat_messages
    ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE;
