from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

StakeholderRole = Literal["affected", "interested", "mentioned", "requester"]


class StakeholderUserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    display_name: str
    email: str


class TicketStakeholderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_id: UUID
    user_id: UUID | None
    role: StakeholderRole
    display_name: str | None = None
    email: str | None = None
    created_at: datetime


class TicketStakeholdersGroupedRead(BaseModel):
    affected: list[StakeholderUserRead] = Field(default_factory=list)
    interested: list[StakeholderUserRead] = Field(default_factory=list)
    mentioned: list[StakeholderUserRead] = Field(default_factory=list)


class TicketStakeholderCreate(BaseModel):
    user_id: UUID
    role: Literal["affected", "interested"]


class TicketStakeholderUpdate(BaseModel):
    role: Literal["affected", "interested"]
