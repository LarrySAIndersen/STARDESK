from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TicketTimestampsRead(BaseModel):
    """Milestone timestamps for a ticket lifecycle."""

    model_config = ConfigDict(from_attributes=True)

    created_at: datetime
    updated_at: datetime | None = None
    gdpr_consent_at: datetime | None = None
    assigned_at: datetime | None = None
    in_progress_at: datetime | None = None
    on_hold_at: datetime | None = None
    first_response_at: datetime | None = None
    resolved_at: datetime | None = None
    closed_at: datetime | None = None
    cancelled_at: datetime | None = None
    last_escalation_at: datetime | None = None
    response_due_at: datetime | None = None
    resolution_due_at: datetime | None = None


class TicketActivityItemRead(BaseModel):
    id: UUID
    occurred_at: datetime
    event_type: str
    label_da: str
    actor_display_name: str | None = None
    visibility: Literal["internal", "external", "system"] = "external"
    detail: str | None = None
