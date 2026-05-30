import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from star_itsm_api.models.base import Base


class WorkboardTask(Base):
    """STARdesk Work Board task — source of truth in Neon, not canvas JSON."""

    __tablename__ = "workboard_tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    canvas_id: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    number: Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    priority: Mapped[str] = mapped_column(String(8), nullable=False, server_default="P2")
    owner: Mapped[str] = mapped_column(String(128), nullable=False, server_default="")
    tags: Mapped[str] = mapped_column(String(512), nullable=False, server_default="")
    source: Mapped[str] = mapped_column(String(64), nullable=False, server_default="")
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workboard_tasks.id", ondelete="SET NULL"),
        nullable=True,
    )
    parent_canvas_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    extra: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")
    field_history: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        server_default="{}",
    )
    activity_log: Mapped[list] = mapped_column(
        JSONB,
        nullable=False,
        server_default="[]",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
