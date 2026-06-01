from datetime import UTC, datetime, timedelta
from uuid import uuid4

from star_itsm_api.services.sla_enrichment import sla_fields_for_ticket
from star_itsm_api.services.sla_pause import sync_sla_pause_on_status_change
from star_itsm_api.services.sla_settings_store import (
    DEFAULT_RUNTIME,
    SlaRuntimeSettings,
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
