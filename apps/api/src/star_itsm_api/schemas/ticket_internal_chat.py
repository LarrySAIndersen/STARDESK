import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from star_itsm_api.schemas.team_chat import TeamChatMessageRead


class TicketInternalChatInviteRequest(BaseModel):
    user_id: uuid.UUID
    message: str | None = Field(default=None, max_length=8000)


class TicketInternalChatMessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=8000)


class TicketInternalChatRead(BaseModel):
    ticket_id: uuid.UUID
    ticket_number: str
    channel_id: uuid.UUID | None
    messages: list[TeamChatMessageRead] = Field(default_factory=list)


class PersonalMentionItemRead(BaseModel):
    kind: Literal["mention", "participant", "invited"]
    ticket_id: uuid.UUID
    ticket_number: str
    ticket_title: str
    channel_id: uuid.UUID | None
    subtitle: str
    last_activity_at: datetime
    invited_by_me: bool


class PersonalMentionsOverviewRead(BaseModel):
    items: list[PersonalMentionItemRead] = Field(default_factory=list)
