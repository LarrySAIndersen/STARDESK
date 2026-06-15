"""Query building for ticket list endpoint."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date

from fastapi import HTTPException
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.http_details import INSUFFICIENT_PERMISSIONS
from star_itsm_api.core.security import ROLE_AGENT, ROLE_SUBMITTER
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.user import User
from star_itsm_api.schemas.ticket import CLOSED_STATUSES
from star_itsm_api.services.dashboard_scope import apply_dashboard_scope_stmt, parse_dashboard_scope
from star_itsm_api.services.knowledge_articles import exclude_knowledge_articles
from star_itsm_api.services.org_access import apply_agent_team_list_filter, apply_ticket_list_filter
from star_itsm_api.services.permissions import can_manage_users, is_staff_role
from star_itsm_api.services.reports import OPEN_STATUSES
from star_itsm_api.services.ticket_dashboard_filters import (
    apply_bucket_filter,
    filter_tickets_by_sla,
    filter_tickets_closed_on,
    filter_tickets_closed_since,
    filter_tickets_created_on,
    filter_tickets_opened_since,
)
from star_itsm_api.services.ticket_search import apply_ticket_search_filter, apply_ticket_tags_filter
from star_itsm_api.services.ticket_tags import normalize_tags
from star_itsm_api.services.ticket_sort import apply_ticket_sort, parse_ticket_sort
from star_itsm_api.services.ticket_stakeholders import apply_stakeholder_ticket_filter

DASHBOARD_PRIORITY_VALUES = frozenset({"critical", "high", "medium", "low"})
DASHBOARD_TICKET_TYPES = frozenset({"incident", "problem", "service_request", "change"})


@dataclass
class ParsedListTicketsQuery:
    parsed_scope: str | None
    parsed_sort: str
    parsed_created_on: date | None
    parsed_closed_on: date | None
    open_only: bool
    limit: int


def _parse_optional_date(value: str | None, field_name: str) -> date | None:
    if value is None:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid {field_name} filter") from None


def validate_list_tickets_query(
    *,
    current_user: User,
    assignee_id: uuid.UUID | None,
    involving_user_id: uuid.UUID | None,
    stakeholder: str | None,
    scope: str | None,
    sla: str | None,
    priority: str | None,
    ticket_type: str | None,
    created_on: str | None,
    closed_on: str | None,
    sort: str,
    open_only: bool,
    limit: int,
) -> ParsedListTicketsQuery:
    if assignee_id is not None and not can_manage_users(current_user):
        raise HTTPException(status_code=403, detail=INSUFFICIENT_PERMISSIONS)
    if stakeholder is not None and stakeholder != "me":
        raise HTTPException(status_code=400, detail="Invalid stakeholder filter")
    if involving_user_id is not None and not can_manage_users(current_user):
        raise HTTPException(status_code=403, detail=INSUFFICIENT_PERMISSIONS)

    parsed_scope = parse_dashboard_scope(scope)
    if scope is not None and parsed_scope is None:
        raise HTTPException(status_code=400, detail="Invalid scope")
    if sla is not None and sla not in ("overdue", "due_soon"):
        raise HTTPException(status_code=400, detail="Invalid sla filter")
    if priority is not None and priority not in DASHBOARD_PRIORITY_VALUES:
        raise HTTPException(status_code=400, detail="Invalid priority filter")
    if ticket_type is not None and ticket_type not in DASHBOARD_TICKET_TYPES:
        raise HTTPException(status_code=400, detail="Invalid ticket_type filter")

    try:
        parsed_sort = parse_ticket_sort(sort)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid sort") from None

    return ParsedListTicketsQuery(
        parsed_scope=parsed_scope,
        parsed_sort=parsed_sort,
        parsed_created_on=_parse_optional_date(created_on, "created_on"),
        parsed_closed_on=_parse_optional_date(closed_on, "closed_on"),
        open_only=open_only,
        limit=limit,
    )


def _has_dashboard_filters(
    parsed: ParsedListTicketsQuery,
    *,
    bucket: str | None,
    sla: str | None,
    opened_since_days: int | None,
    closed_since_days: int | None,
    status: str | None,
    priority: str | None,
    ticket_type: str | None,
    assigned_team_id: uuid.UUID | None,
    parent_id: uuid.UUID | None,
    is_store: bool | None,
    security_only: bool,
) -> bool:
    return (
        parsed.parsed_scope is not None
        or bucket is not None
        or sla is not None
        or opened_since_days is not None
        or closed_since_days is not None
        or status is not None
        or priority is not None
        or parsed.parsed_created_on is not None
        or parsed.parsed_closed_on is not None
        or ticket_type is not None
        or assigned_team_id is not None
        or parent_id is not None
        or is_store is True
        or security_only
    )


def _require_staff(current_user: User) -> None:
    if not is_staff_role(current_user):
        raise HTTPException(status_code=403, detail=INSUFFICIENT_PERMISSIONS)


async def build_list_tickets_stmt(
    db: AsyncSession,
    current_user: User,
    parsed: ParsedListTicketsQuery,
    *,
    store_sager: bool,
    assignee_id: uuid.UUID | None,
    assigned_team_id: uuid.UUID | None,
    bucket: str | None,
    parent_id: uuid.UUID | None,
    has_parent: bool | None,
    is_store: bool | None,
    board: bool,
    major_open: bool,
    security_only: bool,
    sla: str | None,
    opened_since_days: int | None,
    closed_since_days: int | None,
    status: str | None,
    priority: str | None,
    ticket_type: str | None,
    q: str | None,
    tags: list[str] | None,
    tags_match: str,
    stakeholder: str | None,
    involving_user_id: uuid.UUID | None,
) -> Select[tuple[Ticket]]:
    stmt = select(Ticket).where(Ticket.deleted_at.is_(None))
    stmt = exclude_knowledge_articles(stmt)
    stmt = apply_ticket_list_filter(stmt, current_user, store_sager=store_sager)

    if assignee_id is not None:
        stmt = stmt.where(Ticket.assigned_user_id == assignee_id)
    if assigned_team_id is not None:
        _require_staff(current_user)
        stmt = stmt.where(Ticket.assigned_team_id == assigned_team_id)

    dashboard_filters = _has_dashboard_filters(
        parsed,
        bucket=bucket,
        sla=sla,
        opened_since_days=opened_since_days,
        closed_since_days=closed_since_days,
        status=status,
        priority=priority,
        ticket_type=ticket_type,
        assigned_team_id=assigned_team_id,
        parent_id=parent_id,
        is_store=is_store,
        security_only=security_only,
    )

    if parsed.parsed_scope is not None and is_staff_role(current_user):
        stmt = await apply_dashboard_scope_stmt(db, stmt, current_user, parsed.parsed_scope)
    elif parsed.parsed_scope is not None:
        raise HTTPException(status_code=403, detail=INSUFFICIENT_PERMISSIONS)

    if bucket is not None:
        _require_staff(current_user)
        stmt = apply_bucket_filter(stmt, bucket)
    if parent_id is not None:
        stmt = stmt.where(Ticket.parent_ticket_id == parent_id)
    if has_parent is True:
        stmt = stmt.where(Ticket.parent_ticket_id.is_not(None))
    elif has_parent is False:
        stmt = stmt.where(Ticket.parent_ticket_id.is_(None))
    if is_store is True:
        stmt = stmt.where(Ticket.is_major.is_(True), Ticket.parent_ticket_id.is_(None))
    elif is_store is False:
        stmt = stmt.where((Ticket.is_major.is_(False)) | (Ticket.parent_ticket_id.is_not(None)))

    if board:
        _require_staff(current_user)
        parsed.open_only = True
        parsed.limit = min(parsed.limit, 500)
    elif major_open:
        _require_staff(current_user)
        stmt = stmt.where(Ticket.is_major.is_(True), Ticket.status.in_(tuple(OPEN_STATUSES)))
    elif store_sager and current_user.role != ROLE_SUBMITTER:
        raise HTTPException(status_code=403, detail=INSUFFICIENT_PERMISSIONS)
    elif current_user.role == ROLE_AGENT and not dashboard_filters:
        stmt = await apply_agent_team_list_filter(db, stmt, current_user)

    if security_only:
        stmt = stmt.where(Ticket.is_security_ticket.is_(True))
    if parsed.open_only:
        stmt = stmt.where(Ticket.status.notin_(tuple(CLOSED_STATUSES)))
    if status is not None:
        stmt = stmt.where(Ticket.status == status)
    if priority is not None:
        stmt = stmt.where(Ticket.priority == priority)
    if ticket_type is not None:
        stmt = stmt.where(Ticket.ticket_type == ticket_type)

    stmt = apply_ticket_search_filter(stmt, q)
    if tags:
        try:
            normalized_tags = normalize_tags(tags)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        stmt = apply_ticket_tags_filter(
            stmt,
            normalized_tags,
            match_all=tags_match == "all",
        )
    if stakeholder == "me":
        stmt = apply_stakeholder_ticket_filter(stmt, user_id=current_user.id)
    elif involving_user_id is not None:
        stmt = apply_stakeholder_ticket_filter(stmt, user_id=involving_user_id)

    return apply_ticket_sort(stmt, parsed.parsed_sort).limit(parsed.limit)


def apply_list_tickets_post_filters(
    tickets: list[Ticket],
    parsed: ParsedListTicketsQuery,
    *,
    sla: str | None,
    opened_since_days: int | None,
    closed_since_days: int | None,
) -> list[Ticket]:
    if sla is not None:
        tickets = filter_tickets_by_sla(tickets, sla=sla)
    if opened_since_days is not None:
        tickets = filter_tickets_opened_since(tickets, days=opened_since_days)
    if closed_since_days is not None:
        tickets = filter_tickets_closed_since(tickets, days=closed_since_days)
    if parsed.parsed_created_on is not None:
        tickets = filter_tickets_created_on(tickets, on=parsed.parsed_created_on)
    if parsed.parsed_closed_on is not None:
        tickets = filter_tickets_closed_on(tickets, on=parsed.parsed_closed_on)
    return tickets
