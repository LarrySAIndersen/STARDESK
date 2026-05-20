import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class SfChatStatusRead(BaseModel):
    open: bool
    available_agents: int
    message: str


class SfChatPresenceRead(BaseModel):
    is_online: bool
    is_sf_member: bool
    active_session_id: uuid.UUID | None = None
    last_seen_at: datetime | None = None


class SfChatPresenceUpdate(BaseModel):
    online: bool
    force: bool = False


class SfChatLogoutCheckRead(BaseModel):
    can_logout: bool
    reason: str | None = None
    waiting_sessions: int = 0
    active_sessions: int = 0


class SfChatMessageRead(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    sender_user_id: uuid.UUID | None = None
    sender_display_name: str
    body: str
    created_at: datetime
    is_own: bool = False
    is_system: bool = False


class SfChatSessionRead(BaseModel):
    id: uuid.UUID
    status: str
    assigned_agent_id: uuid.UUID | None = None
    assigned_agent_name: str | None = None
    created_at: datetime
    updated_at: datetime
    queue_message: str | None = None


class SfChatSessionCreateResponse(BaseModel):
    session: SfChatSessionRead
    messages: list[SfChatMessageRead] = Field(default_factory=list)


class SfChatMessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class SfChatAgentInboxItem(BaseModel):
    session: SfChatSessionRead
    customer_display_name: str
    customer_email: str
    last_message_preview: str | None = None
    last_message_at: datetime | None = None
    unread_count: int = 0
    customer_is_typing: bool = False


class SfChatAgentInboxRead(BaseModel):
    items: list[SfChatAgentInboxItem]
    online: bool
    notification_count: int


class SfChatPollRead(BaseModel):
    session: SfChatSessionRead | None = None
    messages: list[SfChatMessageRead] = Field(default_factory=list)
    status: SfChatStatusRead


class SfChatCreateTicketBody(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=256)
