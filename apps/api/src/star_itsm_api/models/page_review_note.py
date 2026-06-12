import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from star_itsm_api.models.base import Base

NOTE_STATUSES = frozenset({"open", "resolved"})


class PageReviewNote(Base):
    __tablename__ = "page_review_notes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    page_path: Mapped[str] = mapped_column(String(512), nullable=False)
    page_title: Mapped[str] = mapped_column(String(512), nullable=False, server_default="")
    comment: Mapped[str] = mapped_column(Text, nullable=False)
    position_x: Mapped[float] = mapped_column(Float, nullable=False)
    position_y: Mapped[float] = mapped_column(Float, nullable=False)
    position_selector: Mapped[str | None] = mapped_column(String(512), nullable=True)
    screenshot_storage_key: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default="open")
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
