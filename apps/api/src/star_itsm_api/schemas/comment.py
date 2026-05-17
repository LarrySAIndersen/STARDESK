from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CommentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    body: str
    is_internal: bool
    author_display_name: str
    created_at: datetime


class CommentCreate(BaseModel):
    body: str = Field(min_length=1)
    is_internal: bool = False
