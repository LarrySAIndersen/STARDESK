from datetime import UTC, datetime

from tests.support.tickets import make_test_ticket

from star_itsm_api.services.ticket_timestamps import (
    apply_status_milestone_timestamps,
    maybe_set_first_response,
)


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
