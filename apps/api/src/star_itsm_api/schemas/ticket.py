from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from star_itsm_api.schemas.comment import CommentRead


class TicketRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_number: str
    title: str
    status: str
    priority: str
    ticket_type: str
    created_at: datetime


class TicketDetailRead(TicketRead):
    description: str
    category_id: UUID | None
    subcategory_id: UUID | None
    assigned_team_id: UUID | None
    response_due_at: datetime | None
    resolution_due_at: datetime | None
    escalation_level: int
    comments: list[CommentRead] = Field(default_factory=list)


class TicketCreate(BaseModel):
    ticket_type: Literal["service_request", "incident", "problem"] = "incident"
    title: str = Field(min_length=3, max_length=256)
    description: str = Field(min_length=10)
    priority: Literal["critical", "high", "medium", "low"] = "medium"
    category_id: UUID | None = None
    subcategory_id: UUID | None = None


class TicketStatusUpdate(BaseModel):
    status: Literal[
        "new",
        "assigned",
        "in_progress",
        "on_hold",
        "resolved",
        "closed",
        "cancelled",
    ]
