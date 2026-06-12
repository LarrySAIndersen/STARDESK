from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

WorkspaceSpace = Literal["personal", "team"]

WorkspaceWidgetKind = Literal[
    "personal-dashboard",
    "dispatch-queue",
    "personal-notes",
    "personal-kanban",
    "my-tickets",
    "team-dashboard",
    "team-chat",
    "team-members",
    "team-dispatch",
]

WorkspaceWidgetSpan = Literal["full", "half"]

WORKSPACE_WIDGET_KINDS: frozenset[str] = frozenset(
    [
        "personal-dashboard",
        "dispatch-queue",
        "personal-notes",
        "personal-kanban",
        "my-tickets",
        "team-dashboard",
        "team-chat",
        "team-members",
        "team-dispatch",
    ]
)


class WorkspaceWidgetInstance(BaseModel):
    instance_id: str = Field(min_length=1, max_length=128)
    kind: WorkspaceWidgetKind
    order: int = Field(ge=0, le=999)
    span: WorkspaceWidgetSpan = "full"
    hidden: bool = False


class WorkspaceLandingLayout(BaseModel):
    personal: list[WorkspaceWidgetInstance] = Field(default_factory=list)
    team: list[WorkspaceWidgetInstance] = Field(default_factory=list)


class WorkspaceLandingRead(BaseModel):
    user_id: UUID
    layout: WorkspaceLandingLayout
    layout_version: int
    updated_at: datetime


class WorkspaceLandingUpdate(BaseModel):
    layout: WorkspaceLandingLayout
