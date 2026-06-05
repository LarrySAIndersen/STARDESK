from datetime import UTC, datetime

from star_itsm_api.services.sla import compute_sla_due_dates_sync
from star_itsm_api.services.sla_calendar import add_business_days, add_calendar_hours
from star_itsm_api.services.sla_enrichment import sla_fields_for_ticket
from star_itsm_api.services.sla_status import sla_breached, sla_remaining_seconds
from tests.support.tickets import make_test_ticket


def test_p1_critical_four_calendar_hours() -> None:
    start = datetime(2026, 5, 15, 10, 0, tzinfo=UTC)  # Friday
    _, resolution = compute_sla_due_dates_sync("critical", start)
    assert resolution == add_calendar_hours(start, 4)
    assert resolution.hour == 14


def test_p2_high_eight_calendar_hours() -> None:
    start = datetime(2026, 5, 15, 9, 30, tzinfo=UTC)
    _, resolution = compute_sla_due_dates_sync("high", start)
    assert resolution == add_calendar_hours(start, 8)


def test_p3_medium_three_business_days_over_weekend() -> None:
    start = datetime(2026, 5, 15, 10, 0, tzinfo=UTC)  # Friday
    _, resolution = compute_sla_due_dates_sync("medium", start)
    assert resolution == add_business_days(start, 3)
    assert resolution.weekday() == 2  # Wednesday
    assert resolution.day == 20


def test_p3_from_thursday_skips_weekend() -> None:
    start = datetime(2026, 5, 14, 8, 0, tzinfo=UTC)  # Thursday
    _, resolution = compute_sla_due_dates_sync("medium", start)
    assert resolution.date().isoformat() == "2026-05-19"  # Tuesday


def test_p4_low_five_business_days() -> None:
    start = datetime(2026, 5, 12, 12, 0, tzinfo=UTC)  # Tuesday
    _, resolution = compute_sla_due_dates_sync("low", start)
    assert resolution == add_business_days(start, 5)
    assert resolution.weekday() == 1  # Tuesday next week


def test_sla_remaining_and_breach() -> None:
    due = datetime(2026, 5, 17, 12, 0, tzinfo=UTC)
    now = datetime(2026, 5, 17, 11, 0, tzinfo=UTC)
    assert sla_remaining_seconds(due, now=now) == 3600
    assert not sla_breached(due, now=now, status="in_progress")
    assert sla_breached(due, now=datetime(2026, 5, 17, 13, 0, tzinfo=UTC), status="in_progress")
    assert not sla_breached(due, now=datetime(2026, 5, 17, 14, 0, tzinfo=UTC), status="closed")


def test_sla_fields_for_ticket_open_and_closed() -> None:
    open_ticket = make_test_ticket(
        resolution_due_at=datetime(2030, 5, 17, 14, 0, tzinfo=UTC),
        response_due_at=datetime(2030, 5, 17, 12, 0, tzinfo=UTC),
        status="in_progress",
        priority="medium",
        created_at=datetime(2030, 5, 17, 10, 0, tzinfo=UTC),
    )
    fields = sla_fields_for_ticket(open_ticket)
    assert fields["sla_remaining_seconds"] is not None
    assert fields["sla_breached"] is False

    closed_ticket = make_test_ticket(
        resolution_due_at=datetime(2026, 5, 16, 12, 0, tzinfo=UTC),
        response_due_at=None,
        status="closed",
        priority="medium",
        created_at=datetime(2026, 5, 15, 10, 0, tzinfo=UTC),
    )
    closed_fields = sla_fields_for_ticket(closed_ticket)
    assert closed_fields["sla_remaining_seconds"] is None
    assert closed_fields["sla_breached"] is False


def test_get_sla_rule_fallback() -> None:
    from star_itsm_api.services.sla_config import get_sla_rule
    rule = get_sla_rule("invalid-priority")
    assert rule.priority == "medium"


def test_effective_due_dates_with_none_and_naive_created_at() -> None:
    from star_itsm_api.services.sla_enrichment import (
        effective_resolution_due_at,
        effective_response_due_at,
    )
    ticket = make_test_ticket(
        resolution_due_at=None,
        response_due_at=None,
        status="in_progress",
        priority="medium",
        created_at=datetime(2026, 5, 15, 10, 0),  # naive datetime
    )
    res_due = effective_resolution_due_at(ticket)
    resp_due = effective_response_due_at(ticket)
    assert res_due is not None
    assert res_due.tzinfo == UTC
    assert resp_due is not None
    assert resp_due.tzinfo == UTC

    # Now test with timezone-aware created_at to cover the False branch of tzinfo is None
    ticket_aware = make_test_ticket(
        resolution_due_at=None,
        response_due_at=None,
        status="in_progress",
        priority="medium",
        created_at=datetime(2026, 5, 15, 10, 0, tzinfo=UTC),
    )
    assert effective_resolution_due_at(ticket_aware) is not None
    assert effective_response_due_at(ticket_aware) is not None


def test_effective_due_dates_closed_ticket_with_none() -> None:
    from star_itsm_api.services.sla_enrichment import (
        effective_resolution_due_at,
        effective_response_due_at,
    )
    ticket = make_test_ticket(
        resolution_due_at=None,
        response_due_at=None,
        status="closed",
        priority="medium",
        created_at=datetime(2026, 5, 15, 10, 0, tzinfo=UTC),
    )
    assert effective_resolution_due_at(ticket) is None
    assert effective_response_due_at(ticket) is None


def test_sla_fields_when_clock_should_not_run() -> None:
    import uuid
    from star_itsm_api.services.sla_settings_store import SlaRuntimeSettings
    custom_settings = SlaRuntimeSettings(
        pause_on_hold=True,
        pause_statuses=frozenset({"on_hold"}),
        trigger_team_ids=frozenset({uuid.uuid4()}),  # non-empty
        sla_starts_on_team_assignment=False,
        due_soon_minutes=60,
    )
    ticket = make_test_ticket(
        resolution_due_at=None,
        response_due_at=None,
        status="in_progress",
        priority="medium",
        created_at=datetime(2026, 5, 15, 10, 0, tzinfo=UTC),
        assigned_team_id=None,  # triggers clock not to run
    )
    fields = sla_fields_for_ticket(ticket, settings=custom_settings)
    assert fields["response_due_at"] is None
    assert fields["resolution_due_at"] is None
    assert fields["sla_remaining_seconds"] is None
    assert fields["sla_breached"] is False
