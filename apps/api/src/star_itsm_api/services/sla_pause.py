from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.ticket import Ticket
from star_itsm_api.services.sla import apply_sla_to_ticket
from star_itsm_api.services.sla_settings_store import (
    SlaRuntimeSettings,
    get_sla_runtime_settings,
    is_status_sla_paused,
    sla_applies_to_team,
)


def _ensure_utc(ts: datetime) -> datetime:
    if ts.tzinfo is None:
        return ts.replace(tzinfo=UTC)
    return ts


def sync_sla_pause_on_status_change(
    ticket: Ticket,
    *,
    previous_status: str,
    new_status: str,
    settings: SlaRuntimeSettings,
    now: datetime,
) -> None:
    if not settings.pause_on_hold:
        return

    was_paused = is_status_sla_paused(previous_status, settings)
    is_paused = is_status_sla_paused(new_status, settings)

    if is_paused and not was_paused:
        if ticket.sla_paused_at is None and ticket.resolution_due_at is not None:
            ticket.sla_paused_at = now
        return

    if was_paused and not is_paused:
        _resume_sla_clock(ticket, now=now)


def _resume_sla_clock(ticket: Ticket, *, now: datetime) -> None:
    paused_at = ticket.sla_paused_at
    if paused_at is None:
        return
    paused_at = _ensure_utc(paused_at)
    now = _ensure_utc(now)
    delta = now - paused_at
    if delta.total_seconds() <= 0:
        ticket.sla_paused_at = None
        return

    seconds = int(delta.total_seconds())
    ticket.sla_pause_total_seconds = (ticket.sla_pause_total_seconds or 0) + seconds
    if ticket.resolution_due_at is not None:
        ticket.resolution_due_at = _ensure_utc(ticket.resolution_due_at) + delta
    if ticket.response_due_at is not None:
        ticket.response_due_at = _ensure_utc(ticket.response_due_at) + delta
    ticket.sla_paused_at = None


def _team_in_sla_scope(team_id: object, settings: SlaRuntimeSettings) -> bool:
    if team_id is None:
        return False
    if not settings.trigger_team_ids:
        return True
    return team_id in settings.trigger_team_ids


async def maybe_start_sla_on_assignment(
    db: AsyncSession,
    ticket: Ticket,
    *,
    previous_team_id: object,
    settings: SlaRuntimeSettings | None = None,
    now: datetime | None = None,
) -> None:
    """Start or clear SLA when assignment crosses trigger-group boundaries."""
    runtime = settings or await get_sla_runtime_settings(db)
    ts = now or datetime.now(UTC)

    prev_in = _team_in_sla_scope(previous_team_id, runtime)
    now_in = sla_applies_to_team(ticket, runtime)

    if runtime.sla_starts_on_team_assignment:
        if now_in and not prev_in:
            await apply_sla_to_ticket(db, ticket, start_at=ts, force=True)
            if is_status_sla_paused(ticket.status, runtime) and ticket.sla_paused_at is None:
                ticket.sla_paused_at = ts
        elif prev_in and not now_in:
            ticket.response_due_at = None
            ticket.resolution_due_at = None
            ticket.sla_policy_id = None
            ticket.sla_paused_at = None
        return

    if runtime.trigger_team_ids and prev_in and not now_in:
        ticket.response_due_at = None
        ticket.resolution_due_at = None
        ticket.sla_policy_id = None
        ticket.sla_paused_at = None
