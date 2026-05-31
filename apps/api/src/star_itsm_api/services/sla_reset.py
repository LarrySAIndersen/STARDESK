"""Bulk SLA reset — same due-date rules as priority change (anchor = created_at)."""

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.ticket import Ticket
from star_itsm_api.services.sla import apply_sla_to_ticket
from star_itsm_api.services.ticket_timestamps import touch_ticket_updated

SlaAnchor = Literal["created_at", "now"]


@dataclass(frozen=True)
class SlaResetResult:
    ticket_count: int
    updated_count: int
    dry_run: bool
    anchor: SlaAnchor


async def count_active_tickets(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count()).select_from(Ticket).where(Ticket.deleted_at.is_(None))
    )
    return int(result.scalar_one())


async def reset_all_ticket_sla(
    db: AsyncSession,
    *,
    anchor: SlaAnchor = "created_at",
    dry_run: bool = False,
) -> SlaResetResult:
    """Recalculate SLA due dates and clear escalation for all non-deleted tickets."""
    tickets = (await db.execute(select(Ticket).where(Ticket.deleted_at.is_(None)))).scalars().all()
    count = len(tickets)
    if dry_run:
        return SlaResetResult(
            ticket_count=count,
            updated_count=0,
            dry_run=True,
            anchor=anchor,
        )

    now = datetime.now(UTC)
    for ticket in tickets:
        start_at = now if anchor == "now" else ticket.created_at
        await apply_sla_to_ticket(db, ticket, start_at=start_at, force=True)
        ticket.escalation_level = 0
        ticket.last_escalation_at = None
        touch_ticket_updated(ticket, now)

    await db.commit()
    return SlaResetResult(
        ticket_count=count,
        updated_count=count,
        dry_run=False,
        anchor=anchor,
    )
