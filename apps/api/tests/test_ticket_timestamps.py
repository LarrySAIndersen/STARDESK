from datetime import UTC, datetime

from star_itsm_api.services.ticket_timestamps import (
    apply_status_milestone_timestamps,
    maybe_set_first_response,
)
from tests.support.tickets import make_test_ticket


def test_status_milestones_set_once() -> None:
    ticket = make_test_ticket(
        in_progress_at=None,
        resolved_at=None,
        closed_at=None,
        cancelled_at=None,
        updated_at=None,
    )
    t0 = datetime(2026, 1, 1, 12, 0, tzinfo=UTC)
    apply_status_milestone_timestamps(ticket, "in_progress", now=t0)
    apply_status_milestone_timestamps(ticket, "resolved", now=datetime(2026, 1, 2, tzinfo=UTC))
    assert ticket.in_progress_at == t0
    assert ticket.resolved_at == datetime(2026, 1, 2, tzinfo=UTC)
    assert ticket.updated_at == datetime(2026, 1, 2, tzinfo=UTC)


def test_first_response_only_external_staff() -> None:
    ticket = make_test_ticket(first_response_at=None, updated_at=None)
    maybe_set_first_response(
        ticket, is_staff=True, is_internal=True, now=datetime(2026, 3, 1, 9, 0, tzinfo=UTC)
    )
    assert ticket.first_response_at is None
    maybe_set_first_response(
        ticket,
        is_staff=True,
        is_internal=False,
        now=datetime(2026, 3, 1, 10, 0, tzinfo=UTC),
    )
    assert ticket.first_response_at == datetime(2026, 3, 1, 10, 0, tzinfo=UTC)


def test_maybe_set_assigned_at() -> None:
    import uuid

    from star_itsm_api.services.ticket_timestamps import maybe_set_assigned_at
    
    # 1. No team and no user assigned -> should not set assigned_at
    ticket = make_test_ticket(assigned_at=None, assigned_team_id=None, assigned_user_id=None)
    maybe_set_assigned_at(ticket)
    assert ticket.assigned_at is None
    
    # 2. Team assigned -> should set assigned_at
    ticket = make_test_ticket(assigned_at=None, assigned_team_id=uuid.uuid4(), assigned_user_id=None)
    t0 = datetime(2026, 5, 1, 12, 0, tzinfo=UTC)
    maybe_set_assigned_at(ticket, now=t0)
    assert ticket.assigned_at == t0
    
    # 3. User assigned -> should set assigned_at
    ticket = make_test_ticket(assigned_at=None, assigned_team_id=None, assigned_user_id=uuid.uuid4())
    t1 = datetime(2026, 5, 2, 12, 0, tzinfo=UTC)
    maybe_set_assigned_at(ticket, now=t1)
    assert ticket.assigned_at == t1


def test_default_now_timestamps() -> None:
    from star_itsm_api.services.ticket_timestamps import touch_ticket_updated
    ticket = make_test_ticket(updated_at=None)
    touch_ticket_updated(ticket)
    assert ticket.updated_at is not None
    assert isinstance(ticket.updated_at, datetime)

