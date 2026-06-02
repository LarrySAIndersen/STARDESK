"""Filters for dashboard drill-down links on ticket lists."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import Select

from star_itsm_api.models.ticket import Ticket
from star_itsm_api.services.reports import BUCKET_DEFINITIONS, CLOSED_STATUSES, OPEN_STATUSES
from star_itsm_api.services.sla_enrichment import effective_resolution_due_at
from star_itsm_api.services.sla_status import sla_breached, sla_due_soon


def apply_bucket_filter(stmt: Select[tuple[Ticket]], bucket: str) -> Select[tuple[Ticket]]:
    for key, _, _, statuses in BUCKET_DEFINITIONS:
        if key == bucket:
            return stmt.where(Ticket.status.in_(tuple(statuses)))
    return stmt


def filter_tickets_by_sla(
    tickets: list[Ticket],
    *,
    sla: str,
    now: datetime | None = None,
) -> list[Ticket]:
    reference = now or datetime.now(UTC)
    filtered: list[Ticket] = []
    for ticket in tickets:
        if ticket.status not in OPEN_STATUSES:
            continue
        resolution_due = effective_resolution_due_at(ticket)
        if sla == "overdue":
            if sla_breached(resolution_due, now=reference, status=ticket.status):
                filtered.append(ticket)
        elif sla == "due_soon" and sla_due_soon(
            resolution_due, now=reference, status=ticket.status
        ):
            filtered.append(ticket)
    return filtered


def filter_tickets_opened_since(
    tickets: list[Ticket],
    *,
    days: int,
    now: datetime | None = None,
) -> list[Ticket]:
    reference = now or datetime.now(UTC)
    since = reference - timedelta(days=days)
    return [ticket for ticket in tickets if ticket.created_at >= since]


def filter_tickets_closed_since(
    tickets: list[Ticket],
    *,
    days: int,
    now: datetime | None = None,
) -> list[Ticket]:
    reference = now or datetime.now(UTC)
    since = reference - timedelta(days=days)
    filtered: list[Ticket] = []
    for ticket in tickets:
        if ticket.status not in CLOSED_STATUSES:
            continue
        closed_at = ticket.closed_at or ticket.resolved_at or ticket.updated_at
        if closed_at and closed_at >= since:
            filtered.append(ticket)
    return filtered
