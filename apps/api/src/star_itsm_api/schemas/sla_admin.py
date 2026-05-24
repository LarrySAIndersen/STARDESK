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
    response_time_minutes: int | None = Field(default=None, ge=1, le=60 * 24 * 30)
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


class SlaTeamOptionRead(BaseModel):
    id: UUID
    name: str


class SlaSettingsRead(BaseModel):
    pause_on_hold: bool
    pause_statuses: list[str]
    trigger_team_ids: list[UUID]
    sla_starts_on_team_assignment: bool
    due_soon_minutes: int
    teams: list[SlaTeamOptionRead] = Field(default_factory=list)


class SlaSettingsUpdate(BaseModel):
    pause_on_hold: bool | None = None
    pause_statuses: list[str] | None = None
    trigger_team_ids: list[UUID] | None = None
    sla_starts_on_team_assignment: bool | None = None
    due_soon_minutes: int | None = Field(default=None, ge=1, le=24 * 60)
