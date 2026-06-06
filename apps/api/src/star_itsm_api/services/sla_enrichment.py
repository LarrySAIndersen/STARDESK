from datetime import UTC, datetime

from star_itsm_api.models.ticket import Ticket
from star_itsm_api.services.sla import compute_sla_due_dates_sync
from star_itsm_api.services.sla_settings_store import (
    DEFAULT_RUNTIME,
    SlaRuntimeSettings,
    effective_sla_now,
    sla_clock_should_run,
)
from star_itsm_api.services.sla_status import (
    CLOSED_STATUSES,
    sla_breached,
    sla_remaining_seconds,
)

_EMPTY_SLA: dict[str, datetime | int | bool | None] = {
    "response_due_at": None,
    "resolution_due_at": None,
    "sla_remaining_seconds": None,
    "sla_breached": False,
}


def effective_resolution_due_at(ticket: Ticket) -> datetime | None:
    if ticket.resolution_due_at is not None:
        return ticket.resolution_due_at
    if ticket.status in CLOSED_STATUSES:
        return None
    anchor = ticket.created_at
    if anchor.tzinfo is None:
        anchor = anchor.replace(tzinfo=UTC)
    ticket_type = getattr(ticket, "ticket_type", None)
    _, resolution_due = compute_sla_due_dates_sync(ticket.priority, anchor, ticket_type)
    return resolution_due


def effective_response_due_at(ticket: Ticket) -> datetime | None:
    if ticket.response_due_at is not None:
        return ticket.response_due_at
    if ticket.status in CLOSED_STATUSES:
        return None
    anchor = ticket.created_at
    if anchor.tzinfo is None:
        anchor = anchor.replace(tzinfo=UTC)
    ticket_type = getattr(ticket, "ticket_type", None)
    response_due, _ = compute_sla_due_dates_sync(ticket.priority, anchor, ticket_type)
    return response_due


def sla_fields_for_ticket(
    ticket: Ticket,
    *,
    settings: SlaRuntimeSettings | None = None,
) -> dict[str, datetime | int | bool | None]:
    runtime = settings or DEFAULT_RUNTIME
    if not sla_clock_should_run(ticket, runtime):
        return dict(_EMPTY_SLA)

    resolution_due = effective_resolution_due_at(ticket)
    response_due = effective_response_due_at(ticket)
    remaining: int | None = None
    if ticket.status not in CLOSED_STATUSES:
        now = effective_sla_now(ticket)
        remaining = sla_remaining_seconds(resolution_due, now=now)
    return {
        "response_due_at": response_due,
        "resolution_due_at": resolution_due,
        "sla_remaining_seconds": remaining,
        "sla_breached": sla_breached(
            resolution_due,
            now=effective_sla_now(ticket),
            status=ticket.status,
        ),
    }
