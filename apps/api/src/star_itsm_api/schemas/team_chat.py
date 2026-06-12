import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class TeamChatChannelRead(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: str | None
    is_private: bool
    is_system: bool
    channel_type: str
    unread_count: int = 0
    last_message_at: datetime | None = None
    last_message_preview: str | None = None


class TeamChatChannelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=500)
    is_private: bool = False


class TeamChatReactionRead(BaseModel):
    emoji: str
    count: int
    reacted_by_me: bool


class TeamChatMessageRead(BaseModel):
    id: uuid.UUID
    channel_id: uuid.UUID
    sender_user_id: uuid.UUID | None
    sender_display_name: str
    body: str
    is_bot: bool
    is_own: bool
    tool_call_meta: dict[str, Any] | None = None
    reactions: list[TeamChatReactionRead] = Field(default_factory=list)
    created_at: datetime


class TeamChatMessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=8000)


class TeamChatMessagesRead(BaseModel):
    messages: list[TeamChatMessageRead]


class TeamChatReactionToggle(BaseModel):
    emoji: str = Field(min_length=1, max_length=32)


class TeamChatStaffRead(BaseModel):
    id: uuid.UUID
    display_name: str
    email: str


class TeamChatDmCreate(BaseModel):
    user_id: uuid.UUID


class TeamChatPollRead(BaseModel):
    messages: list[TeamChatMessageRead]
