"""Unit tests for star_itsm_api.services.sla_pause."""

import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from star_itsm_api.services import sla_pause
from star_itsm_api.services.sla_settings_store import SlaRuntimeSettings

NOW = datetime(2026, 5, 20, 10, 0, tzinfo=UTC)


def _settings(
    *,
    pause_on_hold: bool = True,
    trigger_team_ids: frozenset[uuid.UUID] = frozenset(),
    sla_starts_on_team_assignment: bool = False,
) -> SlaRuntimeSettings:
    return SlaRuntimeSettings(
        pause_on_hold=pause_on_hold,
        pause_statuses=frozenset({"on_hold"}),
        trigger_team_ids=trigger_team_ids,
        sla_starts_on_team_assignment=sla_starts_on_team_assignment,
        due_soon_minutes=60,
    )


def _ticket(**kw: object) -> SimpleNamespace:
    base = {
        "status": "in_progress",
        "sla_paused_at": None,
        "sla_pause_total_seconds": 0,
        "resolution_due_at": None,
        "response_due_at": None,
        "sla_policy_id": uuid.uuid4(),
        "assigned_team_id": None,
    }
    base.update(kw)
    return SimpleNamespace(**base)


def test_ensure_utc_naive() -> None:
    naive = datetime(2026, 5, 20, 10, 0)
    out = sla_pause._ensure_utc(naive)
    assert out.tzinfo == UTC


def test_ensure_utc_aware() -> None:
    aware = datetime(2026, 5, 20, 10, 0, tzinfo=UTC)
    assert sla_pause._ensure_utc(aware) is aware


def test_sync_pause_disabled_returns_early() -> None:
    ticket = _ticket()
    sla_pause.sync_sla_pause_on_status_change(
        ticket,  # type: ignore[arg-type]
        previous_status="in_progress",
        new_status="on_hold",
        settings=_settings(pause_on_hold=False),
        now=NOW,
    )
    assert ticket.sla_paused_at is None


def test_sync_pause_starts_pause() -> None:
    ticket = _ticket(resolution_due_at=NOW + timedelta(hours=4))
    sla_pause.sync_sla_pause_on_status_change(
        ticket,  # type: ignore[arg-type]
        previous_status="in_progress",
        new_status="on_hold",
        settings=_settings(),
        now=NOW,
    )
    assert ticket.sla_paused_at == NOW


def test_sync_pause_no_resolution_due_does_not_set() -> None:
    ticket = _ticket(resolution_due_at=None)
    sla_pause.sync_sla_pause_on_status_change(
        ticket,  # type: ignore[arg-type]
        previous_status="in_progress",
        new_status="on_hold",
        settings=_settings(),
        now=NOW,
    )
    assert ticket.sla_paused_at is None


def test_sync_pause_resume_extends_due_dates() -> None:
    due = NOW + timedelta(hours=4)
    ticket = _ticket(
        status="on_hold",
        sla_paused_at=NOW,
        resolution_due_at=due,
        response_due_at=due,
    )
    resume_at = NOW + timedelta(hours=2)
    sla_pause.sync_sla_pause_on_status_change(
        ticket,  # type: ignore[arg-type]
        previous_status="on_hold",
        new_status="in_progress",
        settings=_settings(),
        now=resume_at,
    )
    assert ticket.sla_paused_at is None
    assert ticket.sla_pause_total_seconds == 7200
    assert ticket.resolution_due_at == due + timedelta(hours=2)
    assert ticket.response_due_at == due + timedelta(hours=2)


def test_sync_pause_both_paused_is_noop() -> None:
    ticket = _ticket(status="on_hold", sla_paused_at=NOW)
    sla_pause.sync_sla_pause_on_status_change(
        ticket,  # type: ignore[arg-type]
        previous_status="on_hold",
        new_status="on_hold",
        settings=_settings(),
        now=NOW,
    )
    assert ticket.sla_paused_at == NOW


def test_resume_no_paused_at_returns() -> None:
    ticket = _ticket(sla_paused_at=None)
    sla_pause._resume_sla_clock(ticket, now=NOW)  # type: ignore[arg-type]
    assert ticket.sla_paused_at is None


def test_resume_nonpositive_delta_clears_only() -> None:
    ticket = _ticket(
        sla_paused_at=NOW,
        resolution_due_at=NOW + timedelta(hours=4),
        sla_pause_total_seconds=5,
    )
    sla_pause._resume_sla_clock(ticket, now=NOW)  # type: ignore[arg-type]
    assert ticket.sla_paused_at is None
    assert ticket.sla_pause_total_seconds == 5
    assert ticket.resolution_due_at == NOW + timedelta(hours=4)


def test_resume_without_due_dates() -> None:
    ticket = _ticket(sla_paused_at=NOW, resolution_due_at=None, response_due_at=None)
    sla_pause._resume_sla_clock(ticket, now=NOW + timedelta(hours=1))  # type: ignore[arg-type]
    assert ticket.sla_pause_total_seconds == 3600
    assert ticket.sla_paused_at is None


def test_team_in_sla_scope_none() -> None:
    assert sla_pause._team_in_sla_scope(None, _settings()) is False


def test_team_in_sla_scope_no_triggers() -> None:
    assert sla_pause._team_in_sla_scope(uuid.uuid4(), _settings()) is True


def test_team_in_sla_scope_membership() -> None:
    team = uuid.uuid4()
    settings = _settings(trigger_team_ids=frozenset({team}))
    assert sla_pause._team_in_sla_scope(team, settings) is True
    assert sla_pause._team_in_sla_scope(uuid.uuid4(), settings) is False


@pytest.mark.asyncio
async def test_maybe_start_sla_starts_and_pauses() -> None:
    team = uuid.uuid4()
    ticket = _ticket(assigned_team_id=team, status="on_hold", sla_paused_at=None)
    settings = _settings(sla_starts_on_team_assignment=True)
    with (
        patch.object(sla_pause, "apply_sla_to_ticket", new=AsyncMock()) as apply_mock,
        patch.object(sla_pause, "sla_applies_to_team", return_value=True),
        patch.object(sla_pause, "is_status_sla_paused", return_value=True),
    ):
        await sla_pause.maybe_start_sla_on_assignment(
            AsyncMock(),
            ticket,  # type: ignore[arg-type]
            previous_team_id=None,
            settings=settings,
            now=NOW,
        )
    apply_mock.assert_awaited_once()
    assert ticket.sla_paused_at == NOW


@pytest.mark.asyncio
async def test_maybe_start_sla_starts_without_pause() -> None:
    team = uuid.uuid4()
    ticket = _ticket(assigned_team_id=team, status="in_progress", sla_paused_at=None)
    settings = _settings(sla_starts_on_team_assignment=True)
    with (
        patch.object(sla_pause, "apply_sla_to_ticket", new=AsyncMock()) as apply_mock,
        patch.object(sla_pause, "sla_applies_to_team", return_value=True),
        patch.object(sla_pause, "is_status_sla_paused", return_value=False),
    ):
        await sla_pause.maybe_start_sla_on_assignment(
            AsyncMock(),
            ticket,  # type: ignore[arg-type]
            previous_team_id=None,
            settings=settings,
            now=NOW,
        )
    apply_mock.assert_awaited_once()
    assert ticket.sla_paused_at is None


@pytest.mark.asyncio
async def test_maybe_start_sla_no_boundary_change_is_noop() -> None:
    team = uuid.uuid4()
    ticket = _ticket(assigned_team_id=team, resolution_due_at=NOW)
    settings = _settings(sla_starts_on_team_assignment=True)
    with (
        patch.object(sla_pause, "apply_sla_to_ticket", new=AsyncMock()) as apply_mock,
        patch.object(sla_pause, "sla_applies_to_team", return_value=True),
    ):
        await sla_pause.maybe_start_sla_on_assignment(
            AsyncMock(),
            ticket,  # type: ignore[arg-type]
            previous_team_id=team,
            settings=settings,
            now=NOW,
        )
    apply_mock.assert_not_awaited()
    assert ticket.resolution_due_at == NOW


@pytest.mark.asyncio
async def test_maybe_start_sla_clears_on_leaving_scope_start_mode() -> None:
    prev_team = uuid.uuid4()
    ticket = _ticket(
        assigned_team_id=None,
        resolution_due_at=NOW,
        response_due_at=NOW,
        sla_paused_at=NOW,
    )
    settings = _settings(sla_starts_on_team_assignment=True)
    with (
        patch.object(sla_pause, "apply_sla_to_ticket", new=AsyncMock()) as apply_mock,
        patch.object(sla_pause, "sla_applies_to_team", return_value=False),
    ):
        await sla_pause.maybe_start_sla_on_assignment(
            AsyncMock(),
            ticket,  # type: ignore[arg-type]
            previous_team_id=prev_team,
            settings=settings,
            now=NOW,
        )
    apply_mock.assert_not_awaited()
    assert ticket.resolution_due_at is None
    assert ticket.response_due_at is None
    assert ticket.sla_policy_id is None
    assert ticket.sla_paused_at is None


@pytest.mark.asyncio
async def test_maybe_start_sla_clears_on_leaving_trigger_group() -> None:
    prev_team = uuid.uuid4()
    settings = _settings(trigger_team_ids=frozenset({prev_team}))
    ticket = _ticket(
        assigned_team_id=None,
        resolution_due_at=NOW,
        response_due_at=NOW,
        sla_paused_at=NOW,
    )
    with patch.object(sla_pause, "sla_applies_to_team", return_value=False):
        await sla_pause.maybe_start_sla_on_assignment(
            AsyncMock(),
            ticket,  # type: ignore[arg-type]
            previous_team_id=prev_team,
            settings=settings,
            now=NOW,
        )
    assert ticket.resolution_due_at is None
    assert ticket.sla_policy_id is None


@pytest.mark.asyncio
async def test_maybe_start_sla_loads_settings_and_defaults_now() -> None:
    settings = _settings()
    ticket = _ticket(assigned_team_id=uuid.uuid4())
    with (
        patch.object(
            sla_pause,
            "get_sla_runtime_settings",
            new=AsyncMock(return_value=settings),
        ) as get_mock,
        patch.object(sla_pause, "sla_applies_to_team", return_value=True),
    ):
        await sla_pause.maybe_start_sla_on_assignment(
            AsyncMock(),
            ticket,  # type: ignore[arg-type]
            previous_team_id=uuid.uuid4(),
        )
    get_mock.assert_awaited_once()
    assert ticket.resolution_due_at is None
