from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, Field


class StaffNotificationKind(StrEnum):
    ASSIGNED_TO_ME = "assigned_to_me"
    ASSIGNED_TO_GROUP = "assigned_to_group"
    ASSIGNED_TASK_UPDATED = "assigned_task_updated"
    WATCHED_UPDATE = "watched_update"
    SLA_MILESTONE = "sla_milestone"


class StaffNotificationRead(BaseModel):
    id: str
    kind: StaffNotificationKind
    ticket_id: UUID
    ticket_number: str
    title: str
    summary_da: str
    created_at: datetime
    sla_percent: int | None = Field(
        default=None,
        description="SLA milestone percent (50, 75, 100, 125) when kind is sla_milestone",
    )
