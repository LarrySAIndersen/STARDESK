"""SLA calendar helpers: 24/7 hours and Mon–Fri business days (Europe/Copenhagen naive UTC)."""

from datetime import UTC, datetime, timedelta

from star_itsm_api.services.sla_config import SlaTimeKind


def is_weekend(day: datetime) -> bool:
    return day.weekday() >= 5


def add_calendar_hours(start: datetime, hours: int) -> datetime:
    if start.tzinfo is None:
        start = start.replace(tzinfo=UTC)
    return start + timedelta(hours=hours)


def add_business_days(start: datetime, days: int) -> datetime:
    """Add whole business days (Mon–Fri), preserving time-of-day."""
    if days <= 0:
        return start
    if start.tzinfo is None:
        start = start.replace(tzinfo=UTC)
    current = start
    added = 0
    while added < days:
        current += timedelta(days=1)
        if current.weekday() < 5:
            added += 1
    return current


def add_sla_duration(start: datetime, *, kind: SlaTimeKind, amount: int) -> datetime:
    if kind == "calendar_hours":
        return add_calendar_hours(start, amount)
    return add_business_days(start, amount)
