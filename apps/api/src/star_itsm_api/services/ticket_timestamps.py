from datetime import UTC, datetime

from star_itsm_api.models.ticket import Ticket

_STATUS_MILESTONE_FIELDS: dict[str, str] = {
    "assigned": "assigned_at",
    "in_progress": "in_progress_at",
    "on_hold": "on_hold_at",
    "resolved": "resolved_at",
    "closed": "closed_at",
    "cancelled": "cancelled_at",
}


def touch_ticket_updated(ticket: Ticket, now: datetime | None = None) -> None:
    ticket.updated_at = now or datetime.now(UTC)


def apply_status_milestone_timestamps(
    ticket: Ticket,
    new_status: str,
    *,
    now: datetime | None = None,
) -> None:
    """Set first-occurrence milestone timestamps and last-updated time."""
    ts = now or datetime.now(UTC)
    field_name = _STATUS_MILESTONE_FIELDS.get(new_status)
    if field_name is not None and getattr(ticket, field_name, None) is None:
        setattr(ticket, field_name, ts)
    touch_ticket_updated(ticket, ts)


def maybe_set_assigned_at(ticket: Ticket, *, now: datetime | None = None) -> None:
    ts = now or datetime.now(UTC)
    if ticket.assigned_at is None and (ticket.assigned_team_id or ticket.assigned_user_id):
        ticket.assigned_at = ts
    touch_ticket_updated(ticket, ts)


def maybe_set_first_response(
    ticket: Ticket,
    *,
    is_staff: bool,
    is_internal: bool,
    now: datetime | None = None,
) -> None:
    if not is_staff or is_internal:
        return
    ts = now or datetime.now(UTC)
    if ticket.first_response_at is None:
        ticket.first_response_at = ts
    touch_ticket_updated(ticket, ts)
