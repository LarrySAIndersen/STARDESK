import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from star_itsm_api.models.base import Base


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    ticket_number: Mapped[str] = mapped_column(String(32), nullable=False)
    ticket_type: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    priority: Mapped[str] = mapped_column(String(16), nullable=False)
    reporter_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    assigned_team_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    assigned_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    category_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    subcategory_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    sla_policy_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    response_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_due_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    sla_paused_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sla_pause_total_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    first_response_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    in_progress_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    on_hold_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    gdpr_consent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    gdpr_consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    subject_cpr: Mapped[str | None] = mapped_column(String(11), nullable=True)
    assignment_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    fault_displayed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String(64)), nullable=False, default=list)
    emoji: Mapped[str | None] = mapped_column(String(16), nullable=True)
    semantic_topics: Mapped[list[str]] = mapped_column(
        ARRAY(String(64)),
        nullable=False,
        default=list,
    )
    ease_score: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    complexity_score: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    llm_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    handling_hints: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    intelligence_source: Mapped[str | None] = mapped_column(String(32), nullable=True)
    intelligence_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    routing_metadata: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    is_major: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_shared: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_security_ticket: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_knowledge_article: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    knowledge_status: Mapped[str | None] = mapped_column(String(16), nullable=True)
    knowledge_visibility: Mapped[str | None] = mapped_column(String(16), nullable=True)
    parent_ticket_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="SET NULL"),
        nullable=True,
    )
    escalation_level: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    last_escalation_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
