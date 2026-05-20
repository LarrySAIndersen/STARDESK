from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CommentReactionSummary(BaseModel):
    positive_count: int = 0
    negative_count: int = 0
    current_user_sentiment: Literal["positive", "negative"] | None = None


class CommentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    body: str
    is_internal: bool
    visibility: Literal["internal", "external"]
    visibility_label_da: str
    author_display_name: str
    created_at: datetime
    reactions: CommentReactionSummary = Field(default_factory=CommentReactionSummary)


class CommentReactionUpdate(BaseModel):
    sentiment: Literal["positive", "negative"] | None = None


class CommentCreate(BaseModel):
    body: str = Field(min_length=1)
    is_internal: bool = False
    visibility: Literal["internal", "external"] | None = None
    broadcast_to_children: bool = False
