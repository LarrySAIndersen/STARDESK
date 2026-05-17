from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.constants import TICKET_TYPE_PREFIX
from star_itsm_api.models.ticket import Ticket


async def generate_ticket_number(db: AsyncSession, ticket_type: str) -> str:
    prefix = TICKET_TYPE_PREFIX[ticket_type]
    year = datetime.now(UTC).year
    pattern = f"{prefix}-{year}-%"
    result = await db.execute(
        select(func.count())
        .select_from(Ticket)
        .where(
            Ticket.ticket_number.like(pattern),
            Ticket.deleted_at.is_(None),
        )
    )
    sequence = int(result.scalar() or 0) + 1
    return f"{prefix}-{year}-{sequence:05d}"
