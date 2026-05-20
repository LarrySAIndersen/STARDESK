from uuid import UUID

from pydantic import BaseModel, Field


class SlaPolicyRead(BaseModel):
    id: UUID
    name: str
    description: str | None = None
    response_time_minutes: int
    resolution_time_minutes: int
    business_hours_only: bool
    is_active: bool


class SlaPolicyUpdate(BaseModel):
    description: str | None = None
    response_time_minutes: int | None = Field(default=None, ge=1, le= 60 * 24 * 30)
    resolution_time_minutes: int | None = Field(default=None, ge=1, le=60 * 24 * 30)
    business_hours_only: bool | None = None
    is_active: bool | None = None


class SlaStandardRuleRead(BaseModel):
    priority: str
    label_da: str
    policy_name: str
    response_kind: str
    response_amount: int
    resolution_kind: str
    resolution_amount: int
