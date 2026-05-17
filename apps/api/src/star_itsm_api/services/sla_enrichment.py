from datetime import UTC, datetime

from star_itsm_api.models.ticket import Ticket
from star_itsm_api.services.sla import compute_sla_due_dates_sync
from star_itsm_api.services.sla_status import (
    CLOSED_STATUSES,
    sla_breached,
    sla_remaining_seconds,
)


def effective_resolution_due_at(ticket: Ticket) -> datetime | None:
    if ticket.resolution_due_at is not None:
        return ticket.resolution_due_at
    if ticket.status in CLOSED_STATUSES:
        return None
    anchor = ticket.created_at
    if anchor.tzinfo is None:
        anchor = anchor.replace(tzinfo=UTC)
    _, resolution_due = compute_sla_due_dates_sync(ticket.priority, anchor)
    return resolution_due


def effective_response_due_at(ticket: Ticket) -> datetime | None:
    if ticket.response_due_at is not None:
        return ticket.response_due_at
    if ticket.status in CLOSED_STATUSES:
        return None
    anchor = ticket.created_at
    if anchor.tzinfo is None:
        anchor = anchor.replace(tzinfo=UTC)
    response_due, _ = compute_sla_due_dates_sync(ticket.priority, anchor)
    return response_due


def sla_fields_for_ticket(ticket: Ticket) -> dict[str, datetime | int | bool | None]:
    resolution_due = effective_resolution_due_at(ticket)
    response_due = effective_response_due_at(ticket)
    remaining = sla_remaining_seconds(
        resolution_due,
        status=ticket.status,
    )
    return {
        "response_due_at": response_due,
        "resolution_due_at": resolution_due,
        "sla_remaining_seconds": remaining,
        "sla_breached": sla_breached(resolution_due, status=ticket.status),
    }
