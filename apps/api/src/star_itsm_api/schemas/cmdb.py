import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

CmdbAuditAction = Literal[
    "create",
    "update",
    "delete",
    "connection_add",
    "connection_remove",
]

CmdbEntityType = Literal["system", "subsystem", "edge"]


class CmdbCatalogPayload(BaseModel):
    systems: list[dict[str, Any]] = Field(default_factory=list)
    extra_edges: list[dict[str, Any]] = Field(default_factory=list)
    removed_edge_ids: list[str] = Field(default_factory=list)
    deleted_asset_ids: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class CmdbCatalogRead(BaseModel):
    payload: CmdbCatalogPayload
    updated_at: datetime | None = None


class CmdbCatalogWrite(BaseModel):
    payload: CmdbCatalogPayload


class CmdbAuditCreate(BaseModel):
    action: CmdbAuditAction
    entity_type: CmdbEntityType
    entity_id: str = Field(max_length=64)
    entity_label: str = Field(default="", max_length=500)
    changes: dict[str, Any] = Field(default_factory=dict)
    summary_da: str = Field(default="", max_length=2000)


class CmdbAuditEntryRead(BaseModel):
    id: uuid.UUID
    created_at: datetime
    actor_user_id: uuid.UUID | None
    actor_display_name: str
    action: str
    entity_type: str
    entity_id: str
    entity_label: str
    changes: dict[str, Any]
    summary_da: str


class CmdbAuditLogPage(BaseModel):
    items: list[CmdbAuditEntryRead]
    has_more: bool
    next_before_id: uuid.UUID | None
    approx_bytes: int
