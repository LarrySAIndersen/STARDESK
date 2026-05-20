-- SF chat: system messages (agent/user left, offline) — additive, idempotent

ALTER TABLE sf_chat_messages
    ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE sf_chat_messages
    ALTER COLUMN sender_user_id DROP NOT NULL;
