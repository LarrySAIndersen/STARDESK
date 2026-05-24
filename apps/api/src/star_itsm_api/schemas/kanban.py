from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from star_itsm_api.schemas.ticket import TicketCreate, TicketRead

KanbanMemberRole = Literal["owner", "editor", "viewer"]
KanbanBoardTemplate = Literal["itsm", "simple", "blank", "custom"]


class KanbanBoardMemberRead(BaseModel):
    user_id: UUID
    display_name: str
    role: KanbanMemberRole


class KanbanBoardMemberWrite(BaseModel):
    user_id: UUID
    role: KanbanMemberRole = "editor"


class KanbanBoardSummaryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None = None
    team_id: UUID | None = None
    team_name: str | None = None
    created_by_user_id: UUID
    created_at: datetime
    updated_at: datetime
    my_role: KanbanMemberRole | None = None


class KanbanBoardCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=2000)
    team_id: UUID | None = None
    member_user_ids: list[UUID] = Field(default_factory=list)
    template: KanbanBoardTemplate = "itsm"
    column_names: list[str] = Field(default_factory=list, max_length=12)

    @model_validator(mode="after")
    def custom_template_requires_columns(self) -> "KanbanBoardCreate":
        if self.template == "custom":
            names = [name.strip() for name in self.column_names if name.strip()]
            if not names:
                raise ValueError("custom template requires at least one column name")
            if len(names) > 12:
                raise ValueError("custom template supports at most 12 columns")
        return self


class KanbanBoardUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=2000)
    team_id: UUID | None = None
    members: list[KanbanBoardMemberWrite] | None = None


class KanbanColumnRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    position: int
    statuses: list[str]
    default_status: str | None = None
    is_custom: bool = False
    wip_limit: int | None = None


class KanbanColumnCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    position: int | None = Field(default=None, ge=0)
    default_status: str | None = Field(default=None, max_length=32)
    wip_limit: int | None = Field(default=None, ge=1, le=999)


class KanbanColumnUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    position: int | None = Field(default=None, ge=0)
    default_status: str | None = Field(default=None, max_length=32)
    wip_limit: int | None = Field(default=None, ge=1, le=999)


class KanbanCardRead(BaseModel):
    ticket: TicketRead
    position: int


class KanbanColumnWithCardsRead(BaseModel):
    column: KanbanColumnRead
    cards: list[KanbanCardRead] = Field(default_factory=list)


class KanbanBoardDetailRead(BaseModel):
    board: KanbanBoardSummaryRead
    columns: list[KanbanColumnWithCardsRead]
    members: list[KanbanBoardMemberRead] = Field(default_factory=list)
    can_edit: bool = False
    can_move_cards: bool = False
    can_remove_cards: bool = False
    can_delete_board: bool = False
    can_delete_tickets: bool = False


class KanbanCardMove(BaseModel):
    column_id: UUID
    position: int | None = Field(default=None, ge=0)


class KanbanCardAdd(BaseModel):
    column_id: UUID
    ticket_id: UUID | None = None
    ticket: TicketCreate | None = None

    @model_validator(mode="after")
    def ticket_or_create(self) -> "KanbanCardAdd":
        if self.ticket_id is None and self.ticket is None:
            raise ValueError("Either ticket_id or ticket is required")
        if self.ticket_id is not None and self.ticket is not None:
            raise ValueError("Provide ticket_id or ticket, not both")
        return self


class KanbanCardRemove(BaseModel):
    delete_ticket: bool = False


class KanbanTicketSearchResult(BaseModel):
    id: UUID
    ticket_number: str
    title: str
    status: str
    priority: str
    assigned_team_name: str | None = None
    assigned_user_name: str | None = None
