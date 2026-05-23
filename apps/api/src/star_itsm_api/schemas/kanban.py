from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from star_itsm_api.schemas.ticket import TicketRead

KanbanMemberRole = Literal["owner", "editor", "viewer"]


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
    default_status: str


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


class KanbanCardMove(BaseModel):
    column_id: UUID
    position: int | None = Field(default=None, ge=0)
