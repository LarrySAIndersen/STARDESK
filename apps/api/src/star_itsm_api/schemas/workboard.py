from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class WorkboardTaskRead(BaseModel):
    """Canvas-compatible task JSON (camelCase)."""

    model_config = ConfigDict(populate_by_name=True, extra="allow")

    id: str = Field(description="Canvas id, e.g. t-64")
    number: int
    title: str
    description: str = ""
    status: str
    priority: str = "P2"
    owner: str = ""
    tags: str = ""
    source: str = ""
    parentId: str | None = Field(default=None, validation_alias="parentId")
    fieldHistory: dict[str, list[dict[str, Any]]] | None = Field(
        default=None,
        validation_alias="fieldHistory",
    )
    activityLog: list[dict[str, Any]] | None = Field(
        default=None,
        validation_alias="activityLog",
    )


class WorkboardTaskCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    id: str | None = Field(default=None, description="Canvas id; generated if omitted")
    number: int | None = None
    title: str
    description: str = ""
    status: str = "Backlog"
    priority: str = "P2"
    owner: str = ""
    tags: str = ""
    source: str = "Backlog"
    parentId: str | None = None


class WorkboardTaskUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    title: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    owner: str | None = None
    tags: str | None = None
    source: str | None = None
    parentId: str | None = None
    fieldHistory: dict[str, list[dict[str, Any]]] | None = None
    activityLog: list[dict[str, Any]] | None = None


class WorkboardBulkImportRequest(BaseModel):
    tasks: list[dict[str, Any]] = Field(
        min_length=1,
        description="stardesk-tasks-v1 array from canvas.data.json",
    )
    replace_missing: bool = Field(
        default=False,
        description="Soft-delete DB tasks not present in import batch",
    )


class WorkboardBulkImportResult(BaseModel):
    created: int = 0
    updated: int = 0
    skipped: int = 0
    soft_deleted: int = 0
    status_preserved: int = Field(
        default=0,
        description="Existing tasks whose status was kept (workflow guard blocked regression)",
    )
