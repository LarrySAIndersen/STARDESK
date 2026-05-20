import uuid
from datetime import datetime

from sqlalchemy import DateTime, SmallInteger
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from star_itsm_api.models.base import Base


class CmdbCatalog(Base):
    __tablename__ = "cmdb_catalog"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, default=1)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
