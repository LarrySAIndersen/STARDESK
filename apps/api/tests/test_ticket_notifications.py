import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from star_itsm_api.services.ticket_notifications import (
    TicketUpdateNotification,
    TicketUpdateKind,
    _compose_email,
    _reporter_may_receive_email,
    build_status_notification,
    notify_reporter_of_ticket_update,
)


def test_build_status_notification_danish() -> None:
    note = build_status_notification(previous_status="new", new_status="in_progress")
    assert "I gang" in note.summary_da
    assert note.detail_da is not None
    assert "Ny" in note.detail_da


def test_compose_email_includes_ticket_link(monkeypatch) -> None:
    monkeypatch.setattr(
        "star_itsm_api.services.ticket_notifications.settings",
        SimpleNamespace(cors_origins=["https://app.example.dk"], frontend_url=""),
    )
    ticket = SimpleNamespace(
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
    reporter = SimpleNamespace(
        deleted_at=None,
        is_active=True,
        email="user@example.dk",
        organization_id=org_a,
    )
    ticket = SimpleNamespace(organization_id=org_b)
    assert _reporter_may_receive_email(reporter, ticket) is False


def test_reporter_may_receive_email_no_address() -> None:
    reporter = SimpleNamespace(
        deleted_at=None,
        is_active=True,
        email="   ",
        organization_id=None,
    )
    ticket = SimpleNamespace(organization_id=None)
    assert _reporter_may_receive_email(reporter, ticket) is False


@pytest.mark.asyncio
async def test_notify_skips_when_actor_is_reporter() -> None:
    reporter_id = uuid.uuid4()
    ticket = SimpleNamespace(reporter_user_id=reporter_id, ticket_number="INC-1")
    actor = SimpleNamespace(id=reporter_id)
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
