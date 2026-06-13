"""Self-service ticket watch (interested stakeholder) + activity feed for watchers."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.ticket_event import TicketEvent
from star_itsm_api.models.ticket_stakeholder import TicketStakeholder
from star_itsm_api.models.user import User
from star_itsm_api.schemas.personal import (
    TicketWatchActivityRead,
    TicketWatchSummary,
    WatchedTicketsRead,
)
from star_itsm_api.schemas.ticket import TicketRead
from star_itsm_api.services.org_access import user_can_access_ticket
from star_itsm_api.services.ticket_read import tickets_to_read_list
from star_itsm_api.services.ticket_stakeholders import (
    _get_active_stakeholder,
    soft_delete_stakeholder,
    upsert_stakeholder,
)

WATCH_ROLE = "interested"

_EVENT_SUMMARY_DA: dict[str, str] = {
    "ticket.status_changed": "Status opdateret",
    "ticket.reopened": "Sag genåbnet",
    "ticket.priority_changed": "Prioritet ændret",
    "ticket.assigned": "Tildeling ændret",
    "ticket.metadata_changed": "Metadata opdateret",
    "ticket.type_changed": "Sagstype ændret",
    "ticket.parent_changed": "Overordnet sag ændret",
    "comment.created": "Ny besked på sagen",
    "ticket.attachment.uploaded": "Ny vedhæftning",
    "ticket.attachment.deleted": "Vedhæftning fjernet",
    "ticket.created": "Sag oprettet",
    "email.received": "Ny e-mail på sagen",
    "email.sent": "E-mail sendt på sagen",
}


def _now() -> datetime:
    return datetime.now(UTC)


def _event_summary_da(event_type: str, payload: dict) -> str:
    base = _EVENT_SUMMARY_DA.get(event_type, "Opdatering på sagen")
    if event_type == "ticket.status_changed":
        status = payload.get("status")
        if isinstance(status, str) and status:
            return f"Status ændret til {status}"
    if event_type == "comment.created":
        return base
    return base


async def _require_ticket_access(db: AsyncSession, user: User, ticket: Ticket) -> None:
    if not await user_can_access_ticket(db, user, ticket):
        raise LookupError("ticket_not_found")


async def list_watched_ticket_ids(db: AsyncSession, user: User) -> list[uuid.UUID]:
    result = await db.execute(
        select(TicketStakeholder.ticket_id)
        .where(
            TicketStakeholder.user_id == user.id,
            TicketStakeholder.role == WATCH_ROLE,
            TicketStakeholder.deleted_at.is_(None),
        )
        .order_by(TicketStakeholder.updated_at.desc().nullslast(), TicketStakeholder.created_at.desc())
    )
    return list(result.scalars().all())


async def summarize_watch_state(
    db: AsyncSession,
    user: User,
    ticket_ids: list[uuid.UUID],
) -> list[TicketWatchSummary]:
    if not ticket_ids:
        return []
    watched = set(await list_watched_ticket_ids(db, user))
    return [
        TicketWatchSummary(ticket_id=ticket_id, watching=ticket_id in watched)
        for ticket_id in ticket_ids
    ]


async def list_watched_tickets(db: AsyncSession, user: User) -> WatchedTicketsRead:
    ids = await list_watched_ticket_ids(db, user)
    if not ids:
        return WatchedTicketsRead(ticket_ids=[], tickets=[])
    result = await db.execute(
        select(Ticket).where(
            Ticket.id.in_(ids),
            Ticket.deleted_at.is_(None),
        )
    )
    tickets = list(result.scalars().all())
    order = {ticket_id: index for index, ticket_id in enumerate(ids)}
    tickets.sort(key=lambda row: order.get(row.id, len(ids)))
    reads: list[TicketRead] = await tickets_to_read_list(db, tickets)
    return WatchedTicketsRead(
        ticket_ids=ids,
        tickets=reads,
    )


async def watch_ticket(db: AsyncSession, user: User, ticket_id: uuid.UUID) -> None:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise LookupError("ticket_not_found")
    await _require_ticket_access(db, user, ticket)
    now = _now()
    await upsert_stakeholder(
        db,
        ticket_id=ticket_id,
        user_id=user.id,
        role=WATCH_ROLE,
        now=now,
    )
    await db.commit()


async def unwatch_ticket(db: AsyncSession, user: User, ticket_id: uuid.UUID) -> None:
    ticket = await db.get(Ticket, ticket_id)
    if ticket is None or ticket.deleted_at is not None:
        raise LookupError("ticket_not_found")
    row = await _get_active_stakeholder(
        db,
        ticket_id=ticket_id,
        user_id=user.id,
        role=WATCH_ROLE,
    )
    if row is None:
        return
    soft_delete_stakeholder(db, row, now=_now())
    await db.commit()


async def list_watch_updates(
    db: AsyncSession,
    user: User,
    *,
    since: datetime,
    limit: int = 20,
) -> list[TicketWatchActivityRead]:
    watched_ids = await list_watched_ticket_ids(db, user)
    if not watched_ids:
        return []

    result = await db.execute(
        select(TicketEvent, Ticket.ticket_number, Ticket.title)
        .join(Ticket, Ticket.id == TicketEvent.ticket_id)
        .where(
            TicketEvent.ticket_id.in_(watched_ids),
            TicketEvent.created_at > since,
            Ticket.deleted_at.is_(None),
            TicketEvent.actor_user_id != user.id,
        )
        .order_by(TicketEvent.created_at.desc())
        .limit(limit)
    )

    activities: list[TicketWatchActivityRead] = []
    for event, ticket_number, title in result.all():
        payload = event.payload if isinstance(event.payload, dict) else {}
        activities.append(
            TicketWatchActivityRead(
                ticket_id=event.ticket_id,
                ticket_number=ticket_number,
                title=title,
                event_type=event.event_type,
                summary_da=_event_summary_da(event.event_type, payload),
                created_at=event.created_at,
            )
        )
    return activities
