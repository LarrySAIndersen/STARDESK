"""List tickets associated with a user (reporter, assignee, stakeholder roles)."""

from __future__ import annotations

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.ticket_stakeholder import TicketStakeholder
from star_itsm_api.schemas.ticket import TicketRead
from star_itsm_api.schemas.user_admin import UserTicketsGroupedRead
from star_itsm_api.services.db_resilience import rollback_session
from star_itsm_api.services.ticket_read import tickets_to_read_list

logger = logging.getLogger(__name__)

DEFAULT_GROUP_LIMIT = 100


async def _tickets_for_ids(
    db: AsyncSession,
    ticket_ids: list[uuid.UUID],
    *,
    limit: int,
) -> list[TicketRead]:
    if not ticket_ids:
        return []
    unique_ids = list(dict.fromkeys(ticket_ids))[:limit]
    result = await db.execute(
        select(Ticket)
        .where(
            Ticket.id.in_(unique_ids),
            Ticket.deleted_at.is_(None),
        )
        .order_by(Ticket.created_at.desc())
    )
    tickets = list(result.scalars().all())
    return await tickets_to_read_list(db, tickets)


async def _ticket_ids_by_stakeholder_role(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    role: str,
    limit: int,
) -> list[uuid.UUID]:
    try:
        result = await db.execute(
            select(TicketStakeholder.ticket_id)
            .where(
                TicketStakeholder.user_id == user_id,
                TicketStakeholder.role == role,
                TicketStakeholder.deleted_at.is_(None),
            )
            .order_by(TicketStakeholder.created_at.desc())
            .limit(limit)
        )
        return [row[0] for row in result.all()]
    except Exception:
        logger.warning(
            "Could not load stakeholder tickets for user %s role %s",
            user_id,
            role,
            exc_info=True,
        )
        await rollback_session(db)
        return []


async def list_user_tickets_grouped(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    limit: int = DEFAULT_GROUP_LIMIT,
) -> UserTicketsGroupedRead:
    """Tickets where user is reporter, assignee, or stakeholder (by role)."""
    cap = min(max(limit, 1), 500)

    reported_result = await db.execute(
        select(Ticket.id)
        .where(
            Ticket.reporter_user_id == user_id,
            Ticket.deleted_at.is_(None),
        )
        .order_by(Ticket.created_at.desc())
        .limit(cap)
    )
    reported_ids = [row[0] for row in reported_result.all()]

    assigned_result = await db.execute(
        select(Ticket.id)
        .where(
            Ticket.assigned_user_id == user_id,
            Ticket.deleted_at.is_(None),
        )
        .order_by(Ticket.created_at.desc())
        .limit(cap)
    )
    assigned_ids = [row[0] for row in assigned_result.all()]

    affected_ids = await _ticket_ids_by_stakeholder_role(
        db, user_id=user_id, role="affected", limit=cap
    )
    interested_ids = await _ticket_ids_by_stakeholder_role(
        db, user_id=user_id, role="interested", limit=cap
    )
    mentioned_ids = await _ticket_ids_by_stakeholder_role(
        db, user_id=user_id, role="mentioned", limit=cap
    )

    return UserTicketsGroupedRead(
        reported=await _tickets_for_ids(db, reported_ids, limit=cap),
        assigned=await _tickets_for_ids(db, assigned_ids, limit=cap),
        affected=await _tickets_for_ids(db, affected_ids, limit=cap),
        interested=await _tickets_for_ids(db, interested_ids, limit=cap),
        mentioned=await _tickets_for_ids(db, mentioned_ids, limit=cap),
    )
