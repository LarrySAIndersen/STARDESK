"""In-app staff notifications: assignment, watched tickets, SLA milestones."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import is_staff
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.ticket_event import TicketEvent
from star_itsm_api.models.user import User
from star_itsm_api.schemas.staff_notification import StaffNotificationKind, StaffNotificationRead
from star_itsm_api.services.sla_enrichment import effective_resolution_due_at
from star_itsm_api.services.sla_status import CLOSED_STATUSES
from star_itsm_api.services.teams import get_user_team_ids
from star_itsm_api.services.ticket_watch_service import (
    _event_summary_da,
    list_watched_ticket_ids,
)

SLA_MILESTONE_PERCENTS = (50, 75, 100, 125)

_ASSIGNED_UPDATE_EVENT_TYPES = frozenset(
    {
        "ticket.status_changed",
        "ticket.reopened",
        "ticket.priority_changed",
        "ticket.metadata_changed",
        "ticket.type_changed",
        "comment.created",
        "ticket.attachment.uploaded",
        "email.received",
    }
)


def _ensure_utc(ts: datetime) -> datetime:
    if ts.tzinfo is None:
        return ts.replace(tzinfo=UTC)
    return ts


def _sla_start_at(ticket: Ticket) -> datetime | None:
    anchor = ticket.assigned_at or ticket.created_at
    if anchor is None:
        return None
    return _ensure_utc(anchor)


def _sla_milestone_time(
    *,
    sla_start: datetime,
    total_seconds: float,
    percent: int,
) -> datetime:
    return sla_start + timedelta(seconds=total_seconds * (percent / 100.0))


def _sla_milestone_summary_da(percent: int) -> str:
    if percent >= 125:
        return "SLA er overskredet med 25%"
    if percent >= 100:
        return "SLA-forfald er nået (100%)"
    return f"SLA har nået {percent}% af tidsforbruget"


def _assignment_targets_user(payload: dict, user_id: uuid.UUID) -> bool:
    assigned_user = payload.get("assigned_user_id")
    return isinstance(assigned_user, str) and assigned_user == str(user_id)


def _assignment_targets_team(payload: dict, team_ids: set[uuid.UUID]) -> bool:
    assigned_team = payload.get("assigned_team_id")
    if not isinstance(assigned_team, str):
        return False
    try:
        return uuid.UUID(assigned_team) in team_ids
    except ValueError:
        return False


def _assignment_changed_to_user(payload: dict, user_id: uuid.UUID) -> bool:
    previous = payload.get("previous")
    if not isinstance(previous, dict):
        return _assignment_targets_user(payload, user_id)
    prev_user = previous.get("assigned_user_id")
    new_user = payload.get("assigned_user_id")
    return new_user == str(user_id) and prev_user != new_user


def _assignment_changed_to_team(payload: dict, team_ids: set[uuid.UUID]) -> bool:
    previous = payload.get("previous")
    if not isinstance(previous, dict):
        return _assignment_targets_team(payload, team_ids)
    prev_team = previous.get("assigned_team_id")
    new_team = payload.get("assigned_team_id")
    if not isinstance(new_team, str):
        return False
    try:
        team_uuid = uuid.UUID(new_team)
    except ValueError:
        return False
    return team_uuid in team_ids and prev_team != new_team


async def _relevant_ticket_ids(
    db: AsyncSession,
    user: User,
    *,
    team_ids: list[uuid.UUID],
) -> set[uuid.UUID]:
    watched = await list_watched_ticket_ids(db, user)
    ids: set[uuid.UUID] = set(watched)

    if team_ids:
        team_result = await db.execute(
            select(Ticket.id).where(
                Ticket.deleted_at.is_(None),
                Ticket.assigned_team_id.in_(team_ids),
                Ticket.status.notin_(tuple(CLOSED_STATUSES)),
            )
        )
        ids.update(team_result.scalars().all())

    mine_result = await db.execute(
        select(Ticket.id).where(
            Ticket.deleted_at.is_(None),
            Ticket.assigned_user_id == user.id,
            Ticket.status.notin_(tuple(CLOSED_STATUSES)),
        )
    )
    ids.update(mine_result.scalars().all())
    return ids


async def _sla_milestone_notifications(
    db: AsyncSession,
    *,
    ticket_ids: set[uuid.UUID],
    since: datetime,
    now: datetime,
) -> list[StaffNotificationRead]:
    if not ticket_ids:
        return []

    result = await db.execute(
        select(Ticket).where(
            Ticket.id.in_(ticket_ids),
            Ticket.deleted_at.is_(None),
            Ticket.status.notin_(tuple(CLOSED_STATUSES)),
        )
    )
    notifications: list[StaffNotificationRead] = []
    since_utc = _ensure_utc(since)
    now_utc = _ensure_utc(now)

    for ticket in result.scalars().all():
        resolution_due = effective_resolution_due_at(ticket)
        sla_start = _sla_start_at(ticket)
        if resolution_due is None or sla_start is None:
            continue
        resolution_due = _ensure_utc(resolution_due)
        total_seconds = (resolution_due - sla_start).total_seconds()
        if total_seconds <= 0:
            continue

        for percent in SLA_MILESTONE_PERCENTS:
            milestone_at = _sla_milestone_time(
                sla_start=sla_start,
                total_seconds=total_seconds,
                percent=percent,
            )
            if since_utc < milestone_at <= now_utc:
                notifications.append(
                    StaffNotificationRead(
                        id=f"{ticket.id}:sla:{percent}",
                        kind=StaffNotificationKind.SLA_MILESTONE,
                        ticket_id=ticket.id,
                        ticket_number=ticket.ticket_number,
                        title=ticket.title,
                        summary_da=_sla_milestone_summary_da(percent),
                        created_at=milestone_at,
                        sla_percent=percent,
                    )
                )
    return notifications


async def _assignment_notifications(
    db: AsyncSession,
    user: User,
    *,
    team_ids: set[uuid.UUID],
    since: datetime,
    limit: int,
) -> list[StaffNotificationRead]:
    result = await db.execute(
        select(TicketEvent, Ticket.ticket_number, Ticket.title)
        .join(Ticket, Ticket.id == TicketEvent.ticket_id)
        .where(
            TicketEvent.event_type == "ticket.assigned",
            TicketEvent.created_at > since,
            Ticket.deleted_at.is_(None),
            TicketEvent.actor_user_id != user.id,
        )
        .order_by(TicketEvent.created_at.desc())
        .limit(limit)
    )

    notifications: list[StaffNotificationRead] = []
    for event, ticket_number, title in result.all():
        payload = event.payload if isinstance(event.payload, dict) else {}
        if _assignment_changed_to_user(payload, user.id):
            notifications.append(
                StaffNotificationRead(
                    id=str(event.id),
                    kind=StaffNotificationKind.ASSIGNED_TO_ME,
                    ticket_id=event.ticket_id,
                    ticket_number=ticket_number,
                    title=title,
                    summary_da="En opgave er blevet tildelt dig",
                    created_at=event.created_at,
                )
            )
        elif team_ids and _assignment_changed_to_team(payload, team_ids):
            notifications.append(
                StaffNotificationRead(
                    id=str(event.id),
                    kind=StaffNotificationKind.ASSIGNED_TO_GROUP,
                    ticket_id=event.ticket_id,
                    ticket_number=ticket_number,
                    title=title,
                    summary_da="En opgave er blevet tildelt din ansvarliggruppe",
                    created_at=event.created_at,
                )
            )
    return notifications


async def _assigned_task_update_notifications(
    db: AsyncSession,
    user: User,
    *,
    since: datetime,
    limit: int,
) -> list[StaffNotificationRead]:
    result = await db.execute(
        select(TicketEvent, Ticket.ticket_number, Ticket.title)
        .join(Ticket, Ticket.id == TicketEvent.ticket_id)
        .where(
            Ticket.assigned_user_id == user.id,
            Ticket.deleted_at.is_(None),
            TicketEvent.created_at > since,
            TicketEvent.actor_user_id != user.id,
            TicketEvent.event_type.in_(tuple(_ASSIGNED_UPDATE_EVENT_TYPES)),
        )
        .order_by(TicketEvent.created_at.desc())
        .limit(limit)
    )

    notifications: list[StaffNotificationRead] = []
    for event, ticket_number, title in result.all():
        payload = event.payload if isinstance(event.payload, dict) else {}
        notifications.append(
            StaffNotificationRead(
                id=str(event.id),
                kind=StaffNotificationKind.ASSIGNED_TASK_UPDATED,
                ticket_id=event.ticket_id,
                ticket_number=ticket_number,
                title=title,
                summary_da=_event_summary_da(event.event_type, payload),
                created_at=event.created_at,
            )
        )
    return notifications


async def _watched_update_notifications(
    db: AsyncSession,
    user: User,
    *,
    since: datetime,
    limit: int,
) -> list[StaffNotificationRead]:
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

    notifications: list[StaffNotificationRead] = []
    for event, ticket_number, title in result.all():
        payload = event.payload if isinstance(event.payload, dict) else {}
        notifications.append(
            StaffNotificationRead(
                id=str(event.id),
                kind=StaffNotificationKind.WATCHED_UPDATE,
                ticket_id=event.ticket_id,
                ticket_number=ticket_number,
                title=title,
                summary_da=_event_summary_da(event.event_type, payload),
                created_at=event.created_at,
            )
        )
    return notifications


async def list_staff_notifications(
    db: AsyncSession,
    user: User,
    *,
    since: datetime,
    limit: int = 20,
) -> list[StaffNotificationRead]:
    """Return staff in-app notifications since the given timestamp."""
    if not is_staff(user):
        return []

    now = datetime.now(UTC)
    since_utc = _ensure_utc(since)
    team_ids_list = await get_user_team_ids(db, user.id)
    team_ids = set(team_ids_list)
    per_source_limit = max(limit, 10)

    assignment_rows = await _assignment_notifications(
        db,
        user,
        team_ids=team_ids,
        since=since_utc,
        limit=per_source_limit,
    )
    assigned_update_rows = await _assigned_task_update_notifications(
        db,
        user,
        since=since_utc,
        limit=per_source_limit,
    )
    watched_rows = await _watched_update_notifications(
        db,
        user,
        since=since_utc,
        limit=per_source_limit,
    )

    relevant_ids = await _relevant_ticket_ids(db, user, team_ids=team_ids_list)
    sla_rows = await _sla_milestone_notifications(
        db,
        ticket_ids=relevant_ids,
        since=since_utc,
        now=now,
    )

    merged = assignment_rows + assigned_update_rows + watched_rows + sla_rows
    merged.sort(key=lambda row: row.created_at, reverse=True)

    seen_ids: set[str] = set()
    deduped: list[StaffNotificationRead] = []
    for row in merged:
        if row.id in seen_ids:
            continue
        seen_ids.add(row.id)
        deduped.append(row)
        if len(deduped) >= limit:
            break
    return deduped
