from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class LongestOpenTicket(BaseModel):
    id: UUID
    ticket_number: str
    title: str
    status: str
    status_label_da: str
    days_open: float
    hours_open: float
    created_at: datetime
    assigned_team_name: str | None = None
    priority: str


class CountByLabel(BaseModel):
    key: str
    label_da: str
    count: int


class DailyCount(BaseModel):
    date: str
    count: int


class DashboardRead(BaseModel):
    generated_at: datetime
    open_count: int
    closed_count: int
    major_open_count: int
    sla_overdue_count: int
    sla_due_soon_count: int
    opened_last_7_days: int
    closed_last_7_days: int
    avg_open_age_days: float | None = None
    resolution_rate_pct: float
    longest_open: LongestOpenTicket | None = None
    status_breakdown: list[CountByLabel] = Field(default_factory=list)
    priority_breakdown: list[CountByLabel] = Field(default_factory=list)
    bucket_counts: list[CountByLabel] = Field(default_factory=list)
    daily_created: list[DailyCount] = Field(default_factory=list)
    daily_closed: list[DailyCount] = Field(default_factory=list)
