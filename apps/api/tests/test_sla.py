from datetime import UTC, datetime

from star_itsm_api.services.sla import compute_sla_due_dates_sync
from star_itsm_api.services.sla_calendar import add_business_days, add_calendar_hours
from star_itsm_api.services.sla_status import sla_breached, sla_remaining_seconds


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
