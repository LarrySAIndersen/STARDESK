"""Stable integration API contract — narrow surface for external systems."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

IntegrationTicketType = Literal["service_request", "incident", "problem"]
IntegrationTicketStatus = Literal[
    "new",
    "assigned",
    "in_progress",
    "on_hold",
    "resolved",
    "closed",
    "cancelled",
]
IntegrationTicketPriority = Literal["critical", "high", "medium", "low"]


class IntegrationExternalRef(BaseModel):
    """Cross-system identifier stored on the ticket."""

    system: str = Field(
        min_length=1,
        max_length=64,
        description="Source system slug, e.g. topdesk, jira, servicenow.",
    )
    external_id: str = Field(
        min_length=1,
        max_length=128,
        description="Identifier in the source system.",
    )
    external_url: str | None = Field(
        default=None,
        max_length=2048,
        description="Deep link back to the source record.",
    )


class IntegrationCaseTypeRead(BaseModel):
    """Catalog entry for sagstype / case type."""

    id: str
    label_da: str
    prefix: str
    description_da: str
    allowed_priorities: list[IntegrationTicketPriority]
    allowed_statuses: list[IntegrationTicketStatus]


class IntegrationProfileRead(BaseModel):
    """Capabilities and versioning for integrators."""

    api_version: str = "1.0"
    contract: str = "stardesk-integration-v1"
    openapi_url: str
    auth: list[str]
    capabilities: list[str]
    case_types: list[str]
    pagination: dict[str, int | str]
    external_ref_format: str = "ext:{system}:{external_id}"


class IntegrationTicketRead(BaseModel):
    """Stable ticket projection for machine clients."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_number: str
    ticket_type: str
    title: str
    description: str
    status: IntegrationTicketStatus
    priority: IntegrationTicketPriority
    external_ref: IntegrationExternalRef | None = None
    category_id: UUID | None = None
    assigned_team_id: UUID | None = None
    assigned_user_id: UUID | None = None
    created_at: datetime
    updated_at: datetime | None = None


class IntegrationTicketCreate(BaseModel):
    """Create ticket from an external system."""

    ticket_type: str = "incident"
    title: str = Field(min_length=3, max_length=256)
    description: str = Field(min_length=10)
    priority: IntegrationTicketPriority = "medium"
    external_ref: IntegrationExternalRef
    category_id: UUID | None = None
    status: IntegrationTicketStatus | None = Field(
        default=None,
        description="Optional initial status; defaults to new/assigned after routing.",
    )


class IntegrationTicketPatch(BaseModel):
    """Limited mutable fields for sync back from external systems."""

    title: str | None = Field(default=None, min_length=3, max_length=256)
    description: str | None = Field(default=None, min_length=10)
    status: IntegrationTicketStatus | None = None
    priority: IntegrationTicketPriority | None = None
    ticket_type: str | None = None
    external_ref: IntegrationExternalRef | None = None


class IntegrationTicketListRead(BaseModel):
    page: int
    page_size: int
    total: int
    items: list[IntegrationTicketRead]
