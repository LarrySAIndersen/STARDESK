from datetime import datetime, UTC, timedelta
import pytest

from star_itsm_api.services.sla_status import (
    utc_now,
    sla_remaining_seconds,
    sla_breached,
    sla_due_soon,
)


def test_utc_now() -> None:
    now = utc_now()
    assert now.tzinfo == UTC


def test_sla_remaining_seconds() -> None:
    # 1. due_at is None
    assert sla_remaining_seconds(None) is None

    # 2. paused is True
    due = datetime(2026, 1, 1, 12, 0, tzinfo=UTC)
    assert sla_remaining_seconds(due, paused=True) is None

    # 3. Naive datetimes (without tzinfo)
    due_naive = datetime(2026, 1, 1, 12, 0)
    now_naive = datetime(2026, 1, 1, 11, 0)
    assert sla_remaining_seconds(due_naive, now=now_naive) == 3600

    # 4. Timezone-aware datetimes
    due_aware = datetime(2026, 1, 1, 12, 0, tzinfo=UTC)
    now_aware = datetime(2026, 1, 1, 11, 0, tzinfo=UTC)
    assert sla_remaining_seconds(due_aware, now=now_aware) == 3600


def test_sla_breached() -> None:
    # 1. Status is closed/resolved/cancelled
    due = datetime(2026, 1, 1, 12, 0, tzinfo=UTC)
    now = datetime(2026, 1, 1, 13, 0, tzinfo=UTC) # past due
    assert sla_breached(due, now=now, status="closed") is False
    assert sla_breached(due, now=now, status="resolved") is False
    assert sla_breached(due, now=now, status="cancelled") is False

    # 2. Status is open, but due_at is None
    assert sla_breached(None, now=now, status="new") is False

    # 3. Status is open, due_at is in the future
    due_future = datetime(2026, 1, 1, 14, 0, tzinfo=UTC)
    assert sla_breached(due_future, now=now, status="new") is False

    # 4. Status is open, due_at is in the past
    due_past = datetime(2026, 1, 1, 12, 0, tzinfo=UTC)
    assert sla_breached(due_past, now=now, status="new") is True


def test_sla_due_soon() -> None:
    now = datetime(2026, 1, 1, 12, 0, tzinfo=UTC)

    # 1. Closed status
    due = now + timedelta(minutes=30)
    assert sla_due_soon(due, now=now, status="closed") is False

    # 2. due_at is None
    assert sla_due_soon(None, now=now, status="new") is False

    # 3. due_at is in the past (remaining < 0)
    due_past = now - timedelta(minutes=10)
    assert sla_due_soon(due_past, now=now, status="new") is False

    # 4. due_at is exactly now (remaining == 0)
    assert sla_due_soon(now, now=now, status="new") is True

    # 5. due_at is within threshold (e.g. 30 mins from now, default threshold is 1 hour)
    due_soon = now + timedelta(minutes=30)
    assert sla_due_soon(due_soon, now=now, status="new") is True

    # 6. due_at is outside threshold (e.g. 2 hours from now)
    due_far = now + timedelta(hours=2)
    assert sla_due_soon(due_far, now=now, status="new") is False
