from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from star_itsm_api.schemas.ticket import TicketRead

# ── Personal notes ──────────────────────────────────────────────────

class PersonalNoteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=256)
    content: str = Field(default="", max_length=10000)
    is_pinned: bool = False
    color: str | None = Field(default=None, max_length=32)


class PersonalNoteUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=256)
    content: str | None = Field(default=None, max_length=10000)
    is_pinned: bool | None = None
    sort_order: int | None = None
    color: str | None = Field(default=None, max_length=32)


class PersonalNoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    title: str
    content: str
    is_pinned: bool
    sort_order: int
    color: str | None
    created_at: datetime
    updated_at: datetime


# ── Personal kanban ─────────────────────────────────────────────────

class PersonalKanbanAddCard(BaseModel):
    ticket_id: UUID
    column_name: str | None = Field(default=None, max_length=64)


class PersonalKanbanColumnUpdate(BaseModel):
    column_name: str = Field(min_length=1, max_length=64)


class PersonalKanbanCardRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    ticket_id: UUID
    column_name: str
    sort_order: int
    created_at: datetime


class PersonalKanbanRead(BaseModel):
    columns: list[str]
    cards: list[PersonalKanbanCardRead]
    tickets: list[TicketRead]
