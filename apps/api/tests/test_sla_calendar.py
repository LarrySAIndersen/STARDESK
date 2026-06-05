from datetime import UTC, datetime

from star_itsm_api.services.sla_calendar import (
    add_business_days,
    add_calendar_hours,
    add_sla_duration,
    is_weekend,
)


def test_is_weekend() -> None:
    # 2026-06-03 is Wednesday (weekday)
    assert not is_weekend(datetime(2026, 6, 3))
    # 2026-06-06 is Saturday (weekend)
    assert is_weekend(datetime(2026, 6, 6))
    # 2026-06-07 is Sunday (weekend)
    assert is_weekend(datetime(2026, 6, 7))


def test_add_calendar_hours() -> None:
    # Naive datetime
    start_naive = datetime(2026, 6, 3, 10, 0)
    result_naive = add_calendar_hours(start_naive, 5)
    assert result_naive.tzinfo == UTC
    assert result_naive.hour == 15

    # Aware datetime
    start_aware = datetime(2026, 6, 3, 10, 0, tzinfo=UTC)
    result_aware = add_calendar_hours(start_aware, 5)
    assert result_aware.tzinfo == UTC
    assert result_aware.hour == 15


def test_add_business_days_zero_or_negative() -> None:
    start = datetime(2026, 6, 3, 10, 0)
    assert add_business_days(start, 0) == start
    assert add_business_days(start, -5) == start


def test_add_business_days_naive_and_aware() -> None:
    # Naive
    start_naive = datetime(2026, 6, 3, 10, 0)  # Wednesday
    result_naive = add_business_days(start_naive, 1)  # Thursday
    assert result_naive.tzinfo == UTC
    assert result_naive.day == 4

    # Aware
    start_aware = datetime(2026, 6, 3, 10, 0, tzinfo=UTC)
    result_aware = add_business_days(start_aware, 1)
    assert result_aware.tzinfo == UTC
    assert result_aware.day == 4


def test_add_business_days_spanning_weekend() -> None:
    start = datetime(2026, 6, 5, 10, 0)  # Friday
    result = add_business_days(start, 1)  # Should skip Saturday/Sunday and end on Monday, June 8
    assert result.day == 8
    assert result.weekday() == 0  # Monday


def test_add_sla_duration() -> None:
    start = datetime(2026, 6, 3, 10, 0)
    # calendar_hours
    res_hours = add_sla_duration(start, kind="calendar_hours", amount=2)
    assert res_hours.hour == 12

    # business_days
    res_days = add_sla_duration(start, kind="business_days", amount=2)
    assert res_days.day == 5  # Friday
