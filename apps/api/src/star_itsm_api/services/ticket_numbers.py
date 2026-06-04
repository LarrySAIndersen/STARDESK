from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.constants import TICKET_TYPE_PREFIX
from star_itsm_api.models.ticket import Ticket


async def generate_ticket_number(db: AsyncSession, ticket_type: str) -> str:
    prefix = TICKET_TYPE_PREFIX[ticket_type]
    year = datetime.now(UTC).year
    pattern = f"{prefix}-{year}-%"
    
    # Query the maximum ticket number matching the pattern (including deleted ones to avoid reuse)
    result = await db.execute(
        select(Ticket.ticket_number)
        .where(Ticket.ticket_number.like(pattern))
        .order_by(Ticket.ticket_number.desc())
        .limit(1)
    )
    max_ticket_number = result.scalar_one_or_none()
    
    if max_ticket_number:
        try:
            parts = max_ticket_number.split("-")
            sequence = int(parts[-1]) + 1
        except (ValueError, IndexError):
            sequence = 1
    else:
        sequence = 1
        
    return f"{prefix}-{year}-{sequence:05d}"
