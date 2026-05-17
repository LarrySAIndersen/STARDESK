from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from star_itsm_api.schemas.attachment import AttachmentRead
from star_itsm_api.schemas.comment import CommentRead
from star_itsm_api.schemas.sub_cause import SubCauseRead
from star_itsm_api.schemas.ticket_activity import TicketActivityItemRead, TicketTimestampsRead
from star_itsm_api.services.cpr import assert_no_cpr_outside_field, validate_cpr


CLOSED_STATUSES = frozenset({"closed", "cancelled"})


class TicketRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_number: str
    title: str
    status: str
    priority: str
    ticket_type: str
    is_major: bool = False
    sub_causes: list[SubCauseRead] = Field(default_factory=list)
    category_name_da: str | None = None
    subcategory_name_da: str | None = None
    assigned_team_name: str | None = None
    assigned_user_name: str | None = None
    reporter_display_name: str | None = None
    response_due_at: datetime | None = None
    resolution_due_at: datetime | None = None
    created_at: datetime
    updated_at: datetime | None = None


class TicketDetailRead(TicketRead):
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
    gdpr_consent: bool = False
    subject_cpr: str | None = Field(default=None, max_length=20)

    @field_validator("gdpr_consent")
    @classmethod
    def gdpr_must_be_accepted(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Du skal acceptere behandling af personoplysninger (GDPR)")
        return value

    @field_validator("subject_cpr")
    @classmethod
    def normalize_subject_cpr(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        return validate_cpr(value)

    @model_validator(mode="after")
    def cpr_only_in_dedicated_field(self) -> "TicketCreate":
        assert_no_cpr_outside_field(
            subject_cpr=self.subject_cpr,
            title=self.title,
            description=self.description,
        )
        return self


class TicketMetadataUpdate(BaseModel):
    is_major: bool | None = None
    sub_cause_ids: list[UUID] | None = None


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
