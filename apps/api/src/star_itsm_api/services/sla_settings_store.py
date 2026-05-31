from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.sla_settings import SLA_SETTINGS_SINGLETON_ID, SlaSettings
from star_itsm_api.models.ticket import Ticket


@dataclass(frozen=True)
class SlaRuntimeSettings:
    pause_on_hold: bool
    pause_statuses: frozenset[str]
    trigger_team_ids: frozenset[uuid.UUID]
    sla_starts_on_team_assignment: bool
    due_soon_minutes: int


DEFAULT_RUNTIME = SlaRuntimeSettings(
    pause_on_hold=True,
    pause_statuses=frozenset({"on_hold"}),
    trigger_team_ids=frozenset(),
    sla_starts_on_team_assignment=False,
    due_soon_minutes=60,
)


def _row_to_runtime(row: SlaSettings) -> SlaRuntimeSettings:
    return SlaRuntimeSettings(
        pause_on_hold=row.pause_on_hold,
        pause_statuses=frozenset(row.pause_statuses or ["on_hold"]),
        trigger_team_ids=frozenset(row.trigger_team_ids or []),
        sla_starts_on_team_assignment=row.sla_starts_on_team_assignment,
        due_soon_minutes=row.due_soon_minutes,
    )


async def get_sla_settings_row(db: AsyncSession) -> SlaSettings:
    row = await db.get(SlaSettings, SLA_SETTINGS_SINGLETON_ID)
    if row is not None:
        return row
    row = SlaSettings(
        id=SLA_SETTINGS_SINGLETON_ID,
        pause_on_hold=True,
        pause_statuses=["on_hold"],
        trigger_team_ids=[],
        sla_starts_on_team_assignment=False,
        due_soon_minutes=60,
        updated_at=datetime.now(UTC),
    )
    db.add(row)
    await db.flush()
    return row


async def get_sla_runtime_settings(db: AsyncSession) -> SlaRuntimeSettings:
    try:
        row = await get_sla_settings_row(db)
        return _row_to_runtime(row)
    except Exception:
        return DEFAULT_RUNTIME


def sla_applies_to_team(ticket: Ticket, settings: SlaRuntimeSettings) -> bool:
    if not settings.trigger_team_ids:
        return True
    team_id = ticket.assigned_team_id
    return team_id is not None and team_id in settings.trigger_team_ids


def sla_clock_should_run(ticket: Ticket, settings: SlaRuntimeSettings) -> bool:
    if not sla_applies_to_team(ticket, settings):
        return False
    if settings.sla_starts_on_team_assignment:
        return ticket.assigned_team_id is not None and (
            not settings.trigger_team_ids or ticket.assigned_team_id in settings.trigger_team_ids
        )
    return True


def is_status_sla_paused(status: str, settings: SlaRuntimeSettings) -> bool:
    if not settings.pause_on_hold:
        return False
    return status in settings.pause_statuses


def effective_sla_now(ticket: Ticket, *, now: datetime | None = None) -> datetime:
    reference = now or datetime.now(UTC)
    paused_at = getattr(ticket, "sla_paused_at", None)
    if paused_at is not None:
        if paused_at.tzinfo is None:
            paused_at = paused_at.replace(tzinfo=UTC)
        return paused_at
    if reference.tzinfo is None:
        reference = reference.replace(tzinfo=UTC)
    return reference
