import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

from sqlalchemy import select

from star_itsm_api.models.ticket import Ticket
from star_itsm_api.services.reports import BUCKET_MODTAGET
from star_itsm_api.services.ticket_dashboard_filters import (
    apply_bucket_filter,
    filter_tickets_by_sla,
    filter_tickets_closed_since,
    filter_tickets_opened_since,
)


def _ticket(**kwargs) -> SimpleNamespace:
    defaults = {
        "id": uuid.uuid4(),
        "status": "new",
        "priority": "medium",
        "created_at": datetime(2026, 6, 1, 12, 0, tzinfo=UTC),
        "closed_at": None,
        "resolved_at": None,
        "updated_at": None,
        "resolution_due_at": None,
        "response_due_at": None,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_apply_bucket_filter_modtaget_adds_status_predicate() -> None:
    base = select(Ticket)
    filtered = apply_bucket_filter(base, BUCKET_MODTAGET)
    assert filtered is not base
    compiled = str(filtered.compile(compile_kwargs={"literal_binds": True}))
    assert "new" in compiled or "assigned" in compiled


def test_apply_bucket_filter_unknown_bucket_unchanged() -> None:
    base = select(Ticket)
    assert apply_bucket_filter(base, "does-not-exist") is base


def test_filter_tickets_opened_since() -> None:
    now = datetime(2026, 6, 10, 12, 0, tzinfo=UTC)
    recent = _ticket(created_at=now - timedelta(days=2))
    old = _ticket(created_at=now - timedelta(days=30))
    result = filter_tickets_opened_since([recent, old], days=7, now=now)
    assert result == [recent]


def test_filter_tickets_closed_since_uses_closed_at() -> None:
    now = datetime(2026, 6, 10, 12, 0, tzinfo=UTC)
    closed = _ticket(
        status="closed",
        closed_at=now - timedelta(days=1),
    )
    open_ticket = _ticket(status="in_progress")
    result = filter_tickets_closed_since([closed, open_ticket], days=7, now=now)
    assert result == [closed]


def test_filter_tickets_by_sla_overdue() -> None:
    now = datetime(2026, 6, 10, 12, 0, tzinfo=UTC)
    overdue = _ticket(
        status="in_progress",
        resolution_due_at=now - timedelta(hours=2),
    )
    ok = _ticket(
        status="in_progress",
        resolution_due_at=now + timedelta(hours=5),
    )
    result = filter_tickets_by_sla([overdue, ok], sla="overdue", now=now)
    assert result == [overdue]
