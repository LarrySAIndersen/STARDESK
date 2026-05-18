"""Personal dashboard scope: mine, group, created, or combined personal view."""

from __future__ import annotations

import uuid
from enum import StrEnum

from sqlalchemy import Select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.user import User
from star_itsm_api.services.permissions import has_full_ticket_visibility
from star_itsm_api.services.teams import get_user_team_ids


class DashboardScope(StrEnum):
    personal = "personal"
    mine = "mine"
    group = "group"
    created = "created"
    all = "all"


def parse_dashboard_scope(value: str | None) -> DashboardScope | None:
    if value is None or value == "":
        return None
    try:
        return DashboardScope(value)
    except ValueError:
        return None


def default_dashboard_scope(user: User) -> DashboardScope:
    if has_full_ticket_visibility(user):
        return DashboardScope.all
    return DashboardScope.personal


def ticket_in_scope(
    ticket: Ticket,
    *,
    user_id: uuid.UUID,
    team_ids: list[uuid.UUID],
    scope: DashboardScope,
) -> bool:
    if scope == DashboardScope.all:
        return True
    assigned_to_me = ticket.assigned_user_id == user_id
    in_my_group = bool(
        ticket.assigned_team_id and ticket.assigned_team_id in team_ids,
    )
    created_by_me = ticket.reporter_user_id == user_id
    if scope == DashboardScope.mine:
        return assigned_to_me
    if scope == DashboardScope.group:
        return in_my_group
    if scope == DashboardScope.created:
        return created_by_me
    return assigned_to_me or in_my_group or created_by_me


def filter_tickets_by_scope(
    tickets: list[Ticket],
    *,
    user: User,
    team_ids: list[uuid.UUID],
    scope: DashboardScope,
) -> list[Ticket]:
    if scope == DashboardScope.all:
        return tickets
    return [
        ticket
        for ticket in tickets
        if ticket_in_scope(
            ticket,
            user_id=user.id,
            team_ids=team_ids,
            scope=scope,
        )
    ]


async def apply_dashboard_scope_stmt(
    db: AsyncSession,
    stmt: Select[tuple[Ticket]],
    user: User,
    scope: DashboardScope,
) -> Select[tuple[Ticket]]:
    if scope == DashboardScope.all:
        return stmt
    team_ids = await get_user_team_ids(db, user.id)
    clauses = [Ticket.reporter_user_id == user.id, Ticket.assigned_user_id == user.id]
    if team_ids:
        clauses.append(Ticket.assigned_team_id.in_(team_ids))
    if scope == DashboardScope.mine:
        return stmt.where(Ticket.assigned_user_id == user.id)
    if scope == DashboardScope.group:
        if team_ids:
            return stmt.where(Ticket.assigned_team_id.in_(team_ids))
        return stmt.where(Ticket.id.is_(None))
    if scope == DashboardScope.created:
        return stmt.where(Ticket.reporter_user_id == user.id)
    return stmt.where(or_(*clauses))
