from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from star_itsm_api.schemas.ticket_routing import TicketRoutingRead

IntelligenceSource = Literal["seed", "heuristic", "llm", "manual"]


class TicketIntelligenceRead(BaseModel):
    """Stored or computed triage signals for semantic / ease evaluation."""

    semantic_topics: list[str] = Field(default_factory=list)
    ease_score: int | None = Field(
        default=None,
        ge=1,
        le=5,
        description="1=svær at løse, 5=let (lethed)",
    )
    ease_label_da: str | None = None
    complexity_score: int | None = Field(
        default=None,
        ge=1,
        le=5,
        description="1=simpel, 5=kompleks",
    )
    complexity_label_da: str | None = None
    llm_summary: str | None = None
    handling_hints: list[str] = Field(default_factory=list)
    source: str | None = Field(default=None, description="seed | heuristic | llm | manual")
    updated_at: datetime | None = None


class TicketSemanticBundleRead(BaseModel):
    """Concatenated text fields for embedding or LLM input."""

    title: str
    description: str
    tags: list[str] = Field(default_factory=list)
    emoji: str | None = None
    category_name_da: str | None = None
    subcategory_name_da: str | None = None
    sub_cause_names_da: list[str] = Field(default_factory=list)
    combined_text: str


class TicketLlmOperationalRead(BaseModel):
    status: str
    priority: str
    ticket_type: str
    is_major: bool
    escalation_level: int
    fault_displayed: bool
    assigned_team_name: str | None = None
    assigned_user_name: str | None = None
    organization_name: str | None = None
    age_hours: float
    open_hours: float | None = None


class TicketIntelligenceUpdate(BaseModel):
    """Optional fields for manual or external LLM post-processing."""

    semantic_topics: list[str] | None = None
    ease_score: int | None = Field(default=None, ge=1, le=5)
    complexity_score: int | None = Field(default=None, ge=1, le=5)
    llm_summary: str | None = Field(default=None, max_length=4000)
    handling_hints: list[str] | None = None
    source: IntelligenceSource | None = None


class TicketLlmContextRead(BaseModel):
    """Single document optimized for LLM prompts and batch evaluation."""

    schema_version: str = "1.1"
    ticket_id: UUID
    ticket_number: str
    intelligence: TicketIntelligenceRead
    routing: TicketRoutingRead | None = None
    semantic_bundle: TicketSemanticBundleRead
    operational: TicketLlmOperationalRead
    prompt_snippet_da: str
    evaluation_rubric_da: str


class TicketLlmEvalPackRead(BaseModel):
    schema_version: str = "1.0"
    evaluation_rubric_da: str
    count: int
    items: list[TicketLlmContextRead]
