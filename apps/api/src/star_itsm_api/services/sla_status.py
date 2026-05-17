"""Derived SLA status from a due timestamp."""

from datetime import UTC, datetime

OPEN_STATUSES = frozenset({"new", "assigned", "in_progress", "on_hold"})
CLOSED_STATUSES = frozenset({"resolved", "closed", "cancelled"})
DUE_SOON_SECONDS = 3600


def utc_now() -> datetime:
    return datetime.now(UTC)


def sla_remaining_seconds(
    due_at: datetime | None,
    *,
    now: datetime | None = None,
    paused: bool = False,
) -> int | None:
    if due_at is None or paused:
        return None
    reference = now or utc_now()
    if due_at.tzinfo is None:
        due_at = due_at.replace(tzinfo=UTC)
    if reference.tzinfo is None:
        reference = reference.replace(tzinfo=UTC)
    return int((due_at - reference).total_seconds())


def sla_breached(
    due_at: datetime | None,
    *,
    now: datetime | None = None,
    status: str | None = None,
) -> bool:
    if status in CLOSED_STATUSES:
        return False
    remaining = sla_remaining_seconds(due_at, now=now)
    return remaining is not None and remaining < 0


def sla_due_soon(
    due_at: datetime | None,
    *,
    now: datetime | None = None,
    status: str | None = None,
    threshold_seconds: int = DUE_SOON_SECONDS,
) -> bool:
    if status in CLOSED_STATUSES:
        return False
    remaining = sla_remaining_seconds(due_at, now=now)
    if remaining is None:
        return False
    return 0 <= remaining <= threshold_seconds
