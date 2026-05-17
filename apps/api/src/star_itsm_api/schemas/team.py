from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TeamMemberRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    display_name: str
    email: str
    role: str
    role_label: str
    joined_at: datetime


class TeamRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    is_active: bool
    members: list[TeamMemberRead] = []


class TeamAdminUpdate(BaseModel):
    user_ids: list[UUID] | None = Field(
        default=None,
        description="Replace team membership with this user list when set",
    )
