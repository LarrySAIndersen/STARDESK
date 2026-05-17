from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ReportTicketRow(BaseModel):
    id: UUID
    ticket_number: str
    title: str
    status: str
    status_label_da: str
    priority: str
    ticket_type: str
    assigned_team_name: str | None = None
    assigned_user_name: str | None = None
    organization_id: UUID | None = None
    created_at: datetime
    updated_at: datetime | None = None
    resolved_at: datetime | None = None
    closed_at: datetime | None = None
    reopened_at: datetime | None = None


class ReportBucket(BaseModel):
    key: str
    label_da: str
    description_da: str
    count: int
    tickets: list[ReportTicketRow] = Field(default_factory=list)


class StandardReportRead(BaseModel):
    generated_at: datetime
    period_days: int | None = None
    total_tickets: int
    buckets: list[ReportBucket]
