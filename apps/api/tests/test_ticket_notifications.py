import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from star_itsm_api.services.ticket_notifications import (
    TicketUpdateKind,
    TicketUpdateNotification,
    _compose_email,
    _reporter_may_receive_email,
    build_status_notification,
    notify_reporter_of_ticket_update,
)
from tests.support.tickets import make_test_ticket
from tests.support.users import make_test_user


def test_build_status_notification_danish() -> None:
    note = build_status_notification(previous_status="new", new_status="in_progress")
    assert "I gang" in note.summary_da
    assert note.detail_da is not None
    assert "Ny" in note.detail_da


def test_labels_fallbacks() -> None:
    from star_itsm_api.services.ticket_notifications import _priority_label, _status_label
    assert _status_label(None) == "—"
    assert _status_label("") == "—"
    assert _status_label("unknown_status") == "unknown_status"
    
    assert _priority_label(None) == "—"
    assert _priority_label("") == "—"
    assert _priority_label("unknown_priority") == "unknown_priority"


def test_build_priority_notification() -> None:
    from star_itsm_api.services.ticket_notifications import build_priority_notification
    note = build_priority_notification(previous_priority="high", new_priority="critical", reason="Meget akut")
    assert "Kritisk" in note.summary_da
    assert "Høj" in note.summary_da
    assert note.detail_da == "Meget akut"


def test_build_assignment_and_comment_notifications() -> None:
    from star_itsm_api.services.ticket_notifications import (
        build_assignment_notification,
        build_comment_notification,
    )
    note_assign = build_assignment_notification()
    assert "tildelt eller omfordelt" in note_assign.summary_da
    
    note_comment = build_comment_notification(actor_name="Anna Agent")
    assert "ny besked" in note_comment.summary_da
    assert "Anna Agent" in note_comment.detail_da


def test_ticket_portal_url_variations(monkeypatch) -> None:
    from star_itsm_api.services.ticket_notifications import _ticket_portal_url
    
    # 1. empty cors_origins but has frontend_url
    monkeypatch.setattr(
        "star_itsm_api.services.ticket_notifications.settings",
        SimpleNamespace(cors_origins=[], frontend_url="https://frontend.example.dk"),
    )
    assert _ticket_portal_url(uuid.UUID("00000000-0000-0000-0000-000000000000")) == "https://frontend.example.dk/tickets/00000000-0000-0000-0000-000000000000"
    
    # 2. both empty
    monkeypatch.setattr(
        "star_itsm_api.services.ticket_notifications.settings",
        SimpleNamespace(cors_origins=[], frontend_url=""),
    )
    assert _ticket_portal_url(uuid.UUID("00000000-0000-0000-0000-000000000000")) is None


def test_reporter_may_receive_email_inactive_or_deleted() -> None:
    from datetime import UTC, datetime
    reporter_inactive = make_test_user(email="user@example.dk")
    reporter_inactive.is_active = False
    ticket = make_test_ticket()
    assert _reporter_may_receive_email(reporter_inactive, ticket) is False
    
    reporter_deleted = make_test_user(email="user@example.dk")
    reporter_deleted.is_active = True
    reporter_deleted.deleted_at = datetime.now(UTC)
    assert _reporter_may_receive_email(reporter_deleted, ticket) is False



def test_compose_email_includes_ticket_link(monkeypatch) -> None:
    monkeypatch.setattr(
        "star_itsm_api.services.ticket_notifications.settings",
        SimpleNamespace(cors_origins=["https://app.example.dk"], frontend_url=""),
    )
    ticket = make_test_ticket(
        id=uuid.uuid4(),
        ticket_number="INC-42",
        title="Printer virker ikke",
    )
    subject, body = _compose_email(
        ticket=ticket,
        notification=build_status_notification(previous_status="new", new_status="assigned"),
    )
    assert "INC-42" in subject
    assert "https://app.example.dk/tickets/" in body
    assert "Printer virker ikke" in body


def test_reporter_may_receive_email_org_mismatch() -> None:
    org_a = uuid.uuid4()
    org_b = uuid.uuid4()
    reporter = make_test_user(
        email="user@example.dk",
        organization_id=org_a,
    )
    ticket = make_test_ticket(organization_id=org_b)
    assert _reporter_may_receive_email(reporter, ticket) is False


def test_reporter_may_receive_email_no_address() -> None:
    reporter = make_test_user(email="   ", organization_id=None)
    ticket = make_test_ticket(organization_id=None)
    assert _reporter_may_receive_email(reporter, ticket) is False


@pytest.mark.asyncio
async def test_notify_skips_when_actor_is_reporter() -> None:
    reporter_id = uuid.uuid4()
    ticket = make_test_ticket(reporter_user_id=reporter_id, ticket_number="INC-1")
    actor = make_test_user(user_id=reporter_id)
    with patch(
        "star_itsm_api.services.ticket_notifications.send_escalation_email",
        new_callable=AsyncMock,
    ) as send_mock:
        sent = await notify_reporter_of_ticket_update(
            AsyncMock(),
            ticket=ticket,
            actor=actor,
            notification=TicketUpdateNotification(
                kind=TicketUpdateKind.COMMENT,
                summary_da="Test",
            ),
        )
    assert sent is False
    send_mock.assert_not_called()


@pytest.mark.asyncio
async def test_notify_reporter_success_and_failures() -> None:
    db = AsyncMock()
    reporter_id = uuid.uuid4()
    ticket = make_test_ticket(reporter_user_id=reporter_id, ticket_number="INC-1")
    actor = make_test_user(user_id=uuid.uuid4())  # different from reporter
    
    # 1. Reporter not found in database
    db.get = AsyncMock(return_value=None)
    sent = await notify_reporter_of_ticket_update(
        db,
        ticket=ticket,
        actor=actor,
        notification=TicketUpdateNotification(kind=TicketUpdateKind.COMMENT, summary_da="Test"),
    )
    assert sent is False
    
    # 2. Reporter found, but not eligible (e.g. inactive)
    reporter_inactive = make_test_user(email="user@example.dk")
    reporter_inactive.is_active = False
    db.get = AsyncMock(return_value=reporter_inactive)
    sent = await notify_reporter_of_ticket_update(
        db,
        ticket=ticket,
        actor=actor,
        notification=TicketUpdateNotification(kind=TicketUpdateKind.COMMENT, summary_da="Test"),
    )
    assert sent is False
    
    # 3. Reporter eligible, email sending succeeds
    reporter_active = make_test_user(email="user@example.dk")
    reporter_active.is_active = True
    db.get = AsyncMock(return_value=reporter_active)

    with patch(
        "star_itsm_api.services.ticket_notifications.send_escalation_email",
        AsyncMock(return_value=True),
    ) as send_mock:
        sent = await notify_reporter_of_ticket_update(
            db,
            ticket=ticket,
            actor=actor,
            notification=TicketUpdateNotification(kind=TicketUpdateKind.COMMENT, summary_da="Test"),
        )
        assert sent is True
        send_mock.assert_called_once()
        
    # 4. Reporter eligible, email sending fails
    with patch(
        "star_itsm_api.services.ticket_notifications.send_escalation_email",
        AsyncMock(return_value=False),
    ) as send_mock:
        sent = await notify_reporter_of_ticket_update(
            db,
            ticket=ticket,
            actor=actor,
            notification=TicketUpdateNotification(kind=TicketUpdateKind.COMMENT, summary_da="Test"),
        )
        assert sent is False
        send_mock.assert_called_once()

