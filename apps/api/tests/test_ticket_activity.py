import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from star_itsm_api.models.ticket_event import TicketEvent
from star_itsm_api.services import ticket_activity


def test_ticket_timestamps_read_maps_milestones() -> None:
    created = datetime(2026, 1, 1, 8, 0, tzinfo=UTC)
    ticket = SimpleNamespace(
        created_at=created,
        updated_at=created,
        gdpr_consent_at=None,
        assigned_at=None,
        in_progress_at=created,
        on_hold_at=None,
        first_response_at=None,
        resolved_at=None,
        closed_at=None,
        cancelled_at=None,
        last_escalation_at=None,
        response_due_at=None,
        resolution_due_at=None,
    )
    read = ticket_activity.ticket_timestamps_read(ticket)
    assert read.created_at == created
    assert read.in_progress_at == created


@pytest.mark.parametrize(
    ("event_type", "payload", "label_fragment", "visibility"),
    [
        ("ticket.created", {"ticket_number": "INC-1"}, "oprettet", "external"),
        (
            "ticket.status_changed",
            {"previous_status": "new", "status": "in_progress"},
            "I gang",
            "external",
        ),
        ("ticket.reopened", {"status": "assigned"}, "genåbnet", "external"),
        ("ticket.assigned", {}, "Tildeling", "internal"),
        ("comment.created", {"is_internal": True}, "Intern note", "internal"),
        ("comment.created", {"is_internal": False}, "Ekstern opdatering", "external"),
        (
            "ticket.attachment.uploaded",
            {"filename": "doc.pdf", "scan_status": "clean"},
            "doc.pdf",
            "external",
        ),
        ("sla.escalated", {"level": 2}, "SLA-eskalering", "system"),
        ("ticket.slack_pushed", {"channel_name": "it-support"}, "Slack", "internal"),
        (
            "email.received",
            {"from": "borger@example.dk", "subject": "Hjælp"},
            "E-mail modtaget",
            "external",
        ),
        ("email.sent", {"to": "borger@example.dk", "subject": "Svar"}, "E-mail sendt", "external"),
        ("ticket.unknown_event", {}, "ticket.unknown_event", "internal"),
    ],
)
def test_event_label_branches(
    event_type: str,
    payload: dict,
    label_fragment: str,
    visibility: str,
) -> None:
    label, vis, _detail = ticket_activity._event_label(event_type, payload)
    assert label_fragment.lower() in label.lower()
    assert vis == visibility


@pytest.mark.asyncio
async def test_build_ticket_activity_hides_internal_for_end_user() -> None:
    ticket_id = uuid.uuid4()
    ticket = SimpleNamespace(id=ticket_id)
    end_user = SimpleNamespace(role="end_user")
    actor_id = uuid.uuid4()

    internal_event = TicketEvent()
    internal_event.id = uuid.uuid4()
    internal_event.ticket_id = ticket_id
    internal_event.event_type = "comment.created"
    internal_event.payload = {"is_internal": True}
    internal_event.actor_user_id = actor_id
    internal_event.created_at = datetime.now(UTC)

    external_event = TicketEvent()
    external_event.id = uuid.uuid4()
    external_event.ticket_id = ticket_id
    external_event.event_type = "ticket.created"
    external_event.payload = {"ticket_number": "INC-9"}
    external_event.actor_user_id = actor_id
    external_event.created_at = datetime.now(UTC)

    events_result = MagicMock()
    events_result.scalars.return_value.all.return_value = [internal_event, external_event]

    actor = SimpleNamespace(id=actor_id, display_name="Agent")
    actors_result = MagicMock()
    actors_result.scalars.return_value.all.return_value = [actor]

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[events_result, actors_result])

    items = await ticket_activity.build_ticket_activity(mock_db, ticket, end_user)

    assert len(items) == 1
    assert items[0].event_type == "ticket.created"


@pytest.mark.asyncio
async def test_build_ticket_activity_returns_empty_on_db_failure() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=RuntimeError("db down"))
    mock_db.rollback = AsyncMock()

    ticket = SimpleNamespace(id=uuid.uuid4())
    staff = SimpleNamespace(role="admin")

    items = await ticket_activity.build_ticket_activity(mock_db, ticket, staff)

    assert items == []
