from uuid import UUID

from pydantic import BaseModel, Field


class TicketIntakeRead(BaseModel):
    answers: dict[str, str] = Field(default_factory=dict)


class TicketRoutingRead(BaseModel):
    """Computed routing readiness, intake, suggestions, and priority signals."""

    completeness_score: int = Field(ge=0, le=100)
    routing_ready: bool
    missing_fields_da: list[str] = Field(default_factory=list)
    intake: TicketIntakeRead = Field(default_factory=TicketIntakeRead)
    suggested_team_id: UUID | None = None
    suggested_team_name: str | None = None
    routing_confidence: int | None = Field(default=None, ge=0, le=100)
    routing_reason_da: str | None = None
    computed_priority: str
    computed_priority_label_da: str
    computed_priority_reasons_da: list[str] = Field(default_factory=list)
