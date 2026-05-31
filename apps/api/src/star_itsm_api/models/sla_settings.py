import uuid

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from star_itsm_api.models.base import Base

SLA_SETTINGS_SINGLETON_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")


class SlaSettings(Base):
    __tablename__ = "sla_settings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    pause_on_hold: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    pause_statuses: Mapped[list[str]] = mapped_column(
        ARRAY(String(32)),
        nullable=False,
        default=lambda: ["on_hold"],
    )
    trigger_team_ids: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(UUID(as_uuid=True)),
        nullable=False,
        default=list,
    )
    sla_starts_on_team_assignment: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    due_soon_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False)
