from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from star_itsm_api.schemas.attachment import AttachmentRead
from star_itsm_api.schemas.comment import CommentRead
from star_itsm_api.schemas.sub_cause import SubCauseRead
from star_itsm_api.schemas.ticket_activity import TicketActivityItemRead, TicketTimestampsRead
from star_itsm_api.schemas.ticket_intelligence import TicketIntelligenceRead
from star_itsm_api.schemas.ticket_routing import TicketRoutingRead
from star_itsm_api.services.cpr import assert_no_cpr_outside_field, validate_cpr
from star_itsm_api.services.ticket_tags import normalize_tags, validate_emoji


CLOSED_STATUSES = frozenset({"closed", "cancelled"})


class TicketSummaryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_number: str
    title: str
    status: str
    priority: str
    is_major: bool = False
    is_security_ticket: bool = False


class TicketRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_number: str
    title: str
    status: str
    priority: str
    ticket_type: str
    is_major: bool = False
    is_shared: bool = False
    is_security_ticket: bool = False
    parent_ticket_id: UUID | None = None
    parent: TicketSummaryRead | None = None
    child_count: int = 0
    sub_causes: list[SubCauseRead] = Field(default_factory=list)
    category_name_da: str | None = None
    subcategory_name_da: str | None = None
    assigned_team_id: UUID | None = None
    assigned_team_name: str | None = None
    assigned_user_name: str | None = None
    reporter_display_name: str | None = None
    response_due_at: datetime | None = None
    resolution_due_at: datetime | None = None
    sla_remaining_seconds: int | None = None
    sla_breached: bool = False
    created_at: datetime
    updated_at: datetime | None = None
    fault_displayed: bool = False
    tags: list[str] = Field(default_factory=list)
    emoji: str | None = None
    routing: TicketRoutingRead | None = None
    is_knowledge_article: bool = False
    knowledge_status: str | None = None
    knowledge_status_label_da: str | None = None
    knowledge_visibility: str | None = None
    knowledge_visibility_label_da: str | None = None


class TicketDetailRead(TicketRead):
    children: list[TicketSummaryRead] = Field(default_factory=list)
    related_major_tickets: list[TicketSummaryRead] = Field(default_factory=list)
    intelligence: TicketIntelligenceRead | None = None
    description: str
    category_id: UUID | None
    subcategory_id: UUID | None
    assigned_team_id: UUID | None
    assigned_team_name: str | None = None
    assigned_user_id: UUID | None = None
    assigned_user_name: str | None = None
    response_due_at: datetime | None
    resolution_due_at: datetime | None
    escalation_level: int
    assignment_reason: str | None = None
    fault_displayed: bool = False
    gdpr_consent: bool = False
    gdpr_consent_at: datetime | None = None
    subject_cpr: str | None = None
    attachments: list[AttachmentRead] = Field(default_factory=list)
    comments: list[CommentRead] = Field(default_factory=list)
    timestamps: TicketTimestampsRead
    activity: list[TicketActivityItemRead] = Field(default_factory=list)


class TicketCreate(BaseModel):
    ticket_type: Literal["service_request", "incident", "problem"] = "incident"
    title: str = Field(min_length=3, max_length=256)
    description: str = Field(min_length=10)
    priority: Literal["critical", "high", "medium", "low"] = "medium"
    category_id: UUID | None = None
    subcategory_id: UUID | None = None
    sub_cause_ids: list[UUID] = Field(default_factory=list)
    is_major: bool = False
    is_security_ticket: bool = False
    parent_ticket_id: UUID | None = None
    gdpr_consent: bool = False
    subject_cpr: str | None = Field(default=None, max_length=20)
    tags: list[str] = Field(default_factory=list, max_length=10)
    emoji: str | None = Field(default=None, max_length=16)
    intake_answers: dict[str, str] = Field(default_factory=dict, max_length=20)

    @field_validator("tags")
    @classmethod
    def normalize_create_tags(cls, value: list[str]) -> list[str]:
        return normalize_tags(value)

    @field_validator("emoji")
    @classmethod
    def validate_create_emoji(cls, value: str | None) -> str | None:
        return validate_emoji(value)

    @field_validator("subject_cpr")
    @classmethod
    def normalize_subject_cpr(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        return validate_cpr(value)

    @model_validator(mode="after")
    def privacy_fields(self) -> "TicketCreate":
        assert_no_cpr_outside_field(
            subject_cpr=self.subject_cpr,
            title=self.title,
            description=self.description,
        )
        if self.subject_cpr and not self.gdpr_consent:
            raise ValueError(
                "Du skal acceptere behandling af personoplysninger (GDPR) når du angiver CPR"
            )
        if not self.subject_cpr:
            self.gdpr_consent = False
        return self


class TicketParentUpdate(BaseModel):
    parent_ticket_id: UUID | None = None


class TicketRelatedMajorCreate(BaseModel):
    related_ticket_id: UUID


class TicketPriorityUpdate(BaseModel):
    priority: Literal["critical", "high", "medium", "low"]
    reason: str = Field(min_length=10, max_length=2000)


class TicketMetadataUpdate(BaseModel):
    is_major: bool | None = None
    is_security_ticket: bool | None = None
    parent_ticket_id: UUID | None = None
    sub_cause_ids: list[UUID] | None = None
    tags: list[str] | None = None
    emoji: str | None = Field(default=None, max_length=16)

    @field_validator("tags")
    @classmethod
    def normalize_metadata_tags(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return normalize_tags(value)

    @field_validator("emoji")
    @classmethod
    def validate_metadata_emoji(cls, value: str | None) -> str | None:
        return validate_emoji(value)


class TicketStatusUpdate(BaseModel):
    status: Literal[
        "new",
        "assigned",
        "in_progress",
        "on_hold",
        "resolved",
        "closed",
        "cancelled",
    ]


class TicketAssignmentUpdate(BaseModel):
    assigned_team_id: UUID | None = None
    assigned_user_id: UUID | None = None
    assignment_reason: str | None = Field(default=None, max_length=2000)
    fault_displayed: bool | None = None
