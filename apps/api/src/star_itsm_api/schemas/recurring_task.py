from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

ScheduleUnit = Literal["minute", "hour", "day", "week", "month"]
TaskPriority = Literal["critical", "high", "medium", "low"]


class RecurringTaskCreate(BaseModel):
    title: str = Field(min_length=3, max_length=256)
    description: str = Field(min_length=10)
    priority: TaskPriority = "medium"
    category_id: UUID | None = None
    subcategory_id: UUID | None = None
    assigned_team_id: UUID | None = None
    assigned_user_id: UUID | None = None
    schedule_unit: ScheduleUnit
    schedule_interval: int = Field(ge=1, le=10000)
    is_active: bool = True
    start_at: datetime | None = Field(
        default=None,
        description="First run time (UTC). Defaults to now when omitted.",
    )


class RecurringTaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=256)
    description: str | None = Field(default=None, min_length=10)
    priority: TaskPriority | None = None
    category_id: UUID | None = None
    subcategory_id: UUID | None = None
    assigned_team_id: UUID | None = None
    assigned_user_id: UUID | None = None
    schedule_unit: ScheduleUnit | None = None
    schedule_interval: int | None = Field(default=None, ge=1, le=10000)
    is_active: bool | None = None
    next_run_at: datetime | None = None


class RecurringTaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str
    priority: str
    category_id: UUID | None = None
    subcategory_id: UUID | None = None
    assigned_team_id: UUID | None = None
    assigned_team_name: str | None = None
    assigned_user_id: UUID | None = None
    assigned_user_name: str | None = None
    schedule_unit: str
    schedule_interval: int
    schedule_label_da: str
    next_run_at: datetime
    last_run_at: datetime | None = None
    last_ticket_id: UUID | None = None
    last_ticket_number: str | None = None
    is_active: bool
    created_by_user_id: UUID
    created_at: datetime
    updated_at: datetime


class RecurringTaskRunResult(BaseModel):
    processed: int
    created: int
    checked_at: datetime
