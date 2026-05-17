import logging

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.db import get_db
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.schemas.ticket import TicketRead

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tickets", tags=["tickets"])


@router.get("", response_model=list[TicketRead])
async def list_tickets(
    db: AsyncSession | None = Depends(get_db),
) -> list[TicketRead]:
    if db is None:
        return []

    try:
        result = await db.execute(
            select(Ticket)
            .where(Ticket.deleted_at.is_(None))
            .order_by(Ticket.created_at.desc())
        )
        rows = result.scalars().all()
        return [TicketRead.model_validate(row) for row in rows]
    except Exception:
        logger.exception("Failed to load tickets from database")
        await db.rollback()
        return []
