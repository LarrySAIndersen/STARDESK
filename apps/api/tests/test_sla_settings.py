from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from star_itsm_api.models.sla_settings import SLA_SETTINGS_SINGLETON_ID, SlaSettings
from star_itsm_api.services.sla_enrichment import sla_fields_for_ticket
from star_itsm_api.services.sla_pause import sync_sla_pause_on_status_change
from star_itsm_api.services.sla_settings_store import (
    DEFAULT_RUNTIME,
    SlaRuntimeSettings,
    effective_sla_now,
    get_sla_runtime_settings,
    get_sla_settings_row,
    is_status_sla_paused,
    sla_applies_to_team,
    sla_clock_should_run,
)
from tests.support.tickets import make_test_ticket


def test_sla_applies_to_team_empty_means_all() -> None:
    ticket = make_test_ticket(assigned_team_id=uuid4())
    assert sla_applies_to_team(ticket, DEFAULT_RUNTIME)  # type: ignore[arg-type]


def test_sla_applies_to_team_restricted() -> None:
    team_id = uuid4()
    other = uuid4()
    settings = SlaRuntimeSettings(
        pause_on_hold=True,
        pause_statuses=frozenset({"on_hold"}),
        trigger_team_ids=frozenset({team_id}),
        sla_starts_on_team_assignment=False,
        due_soon_minutes=60,
    )
    in_scope = make_test_ticket(assigned_team_id=team_id)
    out_scope = make_test_ticket(assigned_team_id=other)
    assert sla_applies_to_team(in_scope, settings)  # type: ignore[arg-type]
    assert not sla_applies_to_team(out_scope, settings)  # type: ignore[arg-type]


def test_sla_clock_delayed_until_assignment() -> None:
    team_id = uuid4()
    settings = SlaRuntimeSettings(
        pause_on_hold=True,
        pause_statuses=frozenset({"on_hold"}),
        trigger_team_ids=frozenset(),
        sla_starts_on_team_assignment=True,
        due_soon_minutes=60,
    )
    unassigned = make_test_ticket(assigned_team_id=None, status="new")
    assigned = make_test_ticket(assigned_team_id=team_id, status="assigned")
    assert not sla_clock_should_run(unassigned, settings)  # type: ignore[arg-type]
    assert sla_clock_should_run(assigned, settings)  # type: ignore[arg-type]


def test_pause_on_hold_extends_due_dates() -> None:
    team_id = uuid4()
    settings = DEFAULT_RUNTIME
    now = datetime(2026, 5, 20, 10, 0, tzinfo=UTC)
    due = now + timedelta(hours=4)
    ticket = make_test_ticket(
        status="in_progress",
        resolution_due_at=due,
        response_due_at=due,
        sla_paused_at=None,
        sla_pause_total_seconds=0,
        assigned_team_id=team_id,
        priority="high",
        created_at=now,
    )

    sync_sla_pause_on_status_change(
        ticket,  # type: ignore[arg-type]
        previous_status="in_progress",
        new_status="on_hold",
        settings=settings,
        now=now,
    )
    assert ticket.sla_paused_at == now

    resume_at = now + timedelta(hours=2)
    sync_sla_pause_on_status_change(
        ticket,  # type: ignore[arg-type]
        previous_status="on_hold",
        new_status="in_progress",
        settings=settings,
        now=resume_at,
    )
    assert ticket.sla_paused_at is None
    assert ticket.sla_pause_total_seconds == 7200
    assert ticket.resolution_due_at == due + timedelta(hours=2)


def test_sla_fields_hidden_outside_trigger_groups() -> None:
    team_id = uuid4()
    settings = SlaRuntimeSettings(
        pause_on_hold=True,
        pause_statuses=frozenset({"on_hold"}),
        trigger_team_ids=frozenset({team_id}),
        sla_starts_on_team_assignment=False,
        due_soon_minutes=60,
    )
    ticket = make_test_ticket(
        resolution_due_at=datetime(2030, 5, 17, 14, 0, tzinfo=UTC),
        response_due_at=datetime(2030, 5, 17, 12, 0, tzinfo=UTC),
        status="in_progress",
        priority="medium",
        created_at=datetime(2030, 5, 17, 10, 0, tzinfo=UTC),
        assigned_team_id=uuid4(),
        sla_paused_at=None,
    )
    fields = sla_fields_for_ticket(ticket, settings=settings)  # type: ignore[arg-type]
    assert fields["resolution_due_at"] is None
    assert fields["sla_remaining_seconds"] is None


@pytest.mark.asyncio
async def test_get_sla_settings_row_returns_existing() -> None:
    db = AsyncMock()
    row = SlaSettings(
        id=SLA_SETTINGS_SINGLETON_ID,
        pause_on_hold=False,
        pause_statuses=["waiting"],
        trigger_team_ids=[uuid4()],
        sla_starts_on_team_assignment=True,
        due_soon_minutes=30,
        updated_at=datetime.now(UTC),
    )
    db.get = AsyncMock(return_value=row)
    loaded = await get_sla_settings_row(db)
    assert loaded.pause_on_hold is False
    assert loaded.due_soon_minutes == 30


@pytest.mark.asyncio
async def test_get_sla_settings_row_creates_default() -> None:
    db = AsyncMock()
    db.get = AsyncMock(return_value=None)
    db.add = MagicMock()
    db.flush = AsyncMock()
    row = await get_sla_settings_row(db)
    assert row.id == SLA_SETTINGS_SINGLETON_ID
    assert row.pause_on_hold is True
    db.add.assert_called_once()


@pytest.mark.asyncio
async def test_get_sla_runtime_settings_reads_row() -> None:
    db = AsyncMock()
    row = SlaSettings(
        id=SLA_SETTINGS_SINGLETON_ID,
        pause_on_hold=True,
        pause_statuses=["on_hold", "waiting"],
        trigger_team_ids=[],
        sla_starts_on_team_assignment=False,
        due_soon_minutes=45,
        updated_at=datetime.now(UTC),
    )
    db.get = AsyncMock(return_value=row)
    settings = await get_sla_runtime_settings(db)
    assert settings.due_soon_minutes == 45
    assert settings.pause_statuses == frozenset({"on_hold", "waiting"})


@pytest.mark.asyncio
async def test_get_sla_runtime_settings_falls_back_on_error() -> None:
    db = AsyncMock()
    db.get = AsyncMock(side_effect=RuntimeError("db unavailable"))
    settings = await get_sla_runtime_settings(db)
    assert settings == DEFAULT_RUNTIME


def test_is_status_sla_paused() -> None:
    assert is_status_sla_paused("on_hold", DEFAULT_RUNTIME) is True
    assert is_status_sla_paused("in_progress", DEFAULT_RUNTIME) is False

    disabled = SlaRuntimeSettings(
        pause_on_hold=False,
        pause_statuses=frozenset({"on_hold"}),
        trigger_team_ids=frozenset(),
        sla_starts_on_team_assignment=False,
        due_soon_minutes=60,
    )
    assert is_status_sla_paused("on_hold", disabled) is False


def test_effective_sla_now_uses_pause_timestamp() -> None:
    paused_at = datetime(2026, 6, 1, 12, 0, tzinfo=UTC)
    ticket = make_test_ticket(sla_paused_at=paused_at)
    assert effective_sla_now(ticket) == paused_at  # type: ignore[arg-type]


def test_effective_sla_now_normalizes_naive_datetimes() -> None:
    ticket = make_test_ticket(sla_paused_at=None)
    naive_now = datetime(2026, 6, 1, 12, 0)
    result = effective_sla_now(ticket, now=naive_now)  # type: ignore[arg-type]
    assert result.tzinfo == UTC

    naive_paused = datetime(2026, 6, 1, 11, 0)
    ticket.sla_paused_at = naive_paused
    paused_result = effective_sla_now(ticket)  # type: ignore[arg-type]
    assert paused_result.tzinfo == UTC


def test_sla_clock_should_run_respects_trigger_teams() -> None:
    team_id = uuid4()
    settings = SlaRuntimeSettings(
        pause_on_hold=True,
        pause_statuses=frozenset({"on_hold"}),
        trigger_team_ids=frozenset({team_id}),
        sla_starts_on_team_assignment=True,
        due_soon_minutes=60,
    )
    out_of_scope = make_test_ticket(assigned_team_id=uuid4(), status="assigned")
    in_scope = make_test_ticket(assigned_team_id=team_id, status="assigned")
    assert not sla_clock_should_run(out_of_scope, settings)  # type: ignore[arg-type]
    assert sla_clock_should_run(in_scope, settings)  # type: ignore[arg-type]
