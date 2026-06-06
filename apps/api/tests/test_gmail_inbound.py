"""Batch 15 — Gmail inbound sync, webhook-style ingestion, and outbound reply paths."""

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from star_itsm_api.core.config import settings
from star_itsm_api.models.email_integration import EmailIntegration
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.ticket_email import TicketEmail
from star_itsm_api.services.gmail import (
    GmailApiError,
    InboundEmailMessage,
    _gmail_history_ids,
    _gmail_unread_ids,
    _mark_message_processed,
    list_ticket_emails,
    send_ticket_email_reply,
    sync_gmail_inbox,
)


def _inbound(**kwargs: object) -> InboundEmailMessage:
    defaults: dict[str, object] = {
        "gmail_message_id": "msg-1",
        "gmail_thread_id": "thread-1",
        "internet_message_id": "<msg-1@example.dk>",
        "subject": "Printer fejl",
        "from_email": "kunde@example.com",
        "to_email": "support@example.dk",
        "body_text": "Printeren svarer ikke længere.",
        "received_at": datetime.now(UTC),
        "in_reply_to": None,
        "references": None,
    }
    defaults.update(kwargs)
    return InboundEmailMessage(**defaults)  # type: ignore[arg-type]


def _execute_result(value: object | None) -> MagicMock:
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    return result


@pytest.mark.asyncio
async def test_sync_gmail_inbox_mock_mode_creates_and_appends(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "gmail_mock", True)
    org_id = uuid.uuid4()
    actor_id = uuid.uuid4()
    created_ticket = Ticket(id=uuid.uuid4(), ticket_number="INC-2026-00999")

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=_execute_result(None))

    with (
        patch(
            "star_itsm_api.services.gmail.get_email_integration",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch(
            "star_itsm_api.services.gmail._existing_ticket_for_thread",
            new_callable=AsyncMock,
            side_effect=[None, created_ticket.id],
        ),
        patch(
            "star_itsm_api.services.gmail._create_ticket_from_inbound",
            new_callable=AsyncMock,
            return_value=created_ticket,
        ),
    ):
        stats = await sync_gmail_inbox(
            mock_db,
            organization_id=org_id,
            actor_user_id=actor_id,
        )

    assert stats.processed == 2
    assert stats.created_tickets == 1
    assert stats.appended_to_threads == 1
    assert stats.skipped_duplicates == 0
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_sync_gmail_inbox_mock_skips_duplicates(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "gmail_mock", True)
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=_execute_result(TicketEmail()))

    with patch(
        "star_itsm_api.services.gmail.get_email_integration",
        new_callable=AsyncMock,
        return_value=None,
    ):
        stats = await sync_gmail_inbox(
            mock_db,
            organization_id=uuid.uuid4(),
            actor_user_id=uuid.uuid4(),
        )

    assert stats.processed == 0
    assert stats.skipped_duplicates == 2


@pytest.mark.asyncio
async def test_sync_gmail_inbox_not_connected_raises() -> None:
    mock_db = AsyncMock()
    with (
        patch(
            "star_itsm_api.services.gmail.get_email_integration",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch.object(settings, "gmail_mock", False),
        pytest.raises(GmailApiError, match="ikke forbundet"),
    ):
        await sync_gmail_inbox(
            mock_db,
            organization_id=uuid.uuid4(),
            actor_user_id=uuid.uuid4(),
        )


@pytest.mark.asyncio
async def test_sync_gmail_inbox_real_path_processes_message(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    org_id = uuid.uuid4()
    actor_id = uuid.uuid4()
    integration = EmailIntegration(
        organization_id=org_id,
        provider="gmail",
        refresh_token_encrypted="plain:token",
        connected_email="desk@example.dk",
        last_history_id="hist-1",
    )
    ticket = Ticket(id=uuid.uuid4(), ticket_number="INC-2026-00001")
    message_payload = {
        "id": "gmail-new",
        "threadId": "thread-new",
        "internalDate": "1710000000000",
        "payload": {
            "mimeType": "text/plain",
            "headers": [
                {"name": "From", "value": "kunde@example.com"},
                {"name": "To", "value": "support@example.dk"},
                {"name": "Subject", "value": "Netværk nede"},
            ],
            "body": {"data": "SGVq"},
        },
    }

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=_execute_result(None))

    with (
        patch.object(settings, "gmail_mock", False),
        patch.object(settings, "gmail_sync_from_email", "support@example.dk"),
        patch(
            "star_itsm_api.services.gmail.get_email_integration",
            new_callable=AsyncMock,
            return_value=integration,
        ),
        patch(
            "star_itsm_api.services.gmail.refresh_access_token",
            new_callable=AsyncMock,
            return_value="access-token",
        ),
        patch(
            "star_itsm_api.services.gmail._gmail_history_ids",
            new_callable=AsyncMock,
            return_value=(["gmail-new"], "hist-2"),
        ),
        patch(
            "star_itsm_api.services.gmail._gmail_get_json",
            new_callable=AsyncMock,
            return_value=message_payload,
        ),
        patch(
            "star_itsm_api.services.gmail._existing_ticket_for_thread",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch(
            "star_itsm_api.services.gmail._create_ticket_from_inbound",
            new_callable=AsyncMock,
            return_value=ticket,
        ),
        patch(
            "star_itsm_api.services.gmail._mark_message_processed",
            new_callable=AsyncMock,
        ) as mark_processed,
    ):
        stats = await sync_gmail_inbox(
            mock_db,
            organization_id=org_id,
            actor_user_id=actor_id,
        )

    assert stats.processed == 1
    assert stats.created_tickets == 1
    mark_processed.assert_awaited_once_with("access-token", "gmail-new")
    assert integration.last_history_id == "hist-2"
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_sync_gmail_inbox_skips_self_sent_and_wrong_mailbox(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    org_id = uuid.uuid4()
    integration = EmailIntegration(
        organization_id=org_id,
        provider="gmail",
        refresh_token_encrypted="plain:token",
        connected_email="desk@example.dk",
    )
    self_message = _inbound(from_email="desk@example.dk")
    foreign_message = _inbound(to_email="other@example.dk")

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=_execute_result(None))

    with (
        patch.object(settings, "gmail_mock", False),
        patch.object(settings, "gmail_sync_from_email", "support@example.dk"),
        patch(
            "star_itsm_api.services.gmail.get_email_integration",
            new_callable=AsyncMock,
            return_value=integration,
        ),
        patch(
            "star_itsm_api.services.gmail.refresh_access_token",
            new_callable=AsyncMock,
            return_value="access-token",
        ),
        patch(
            "star_itsm_api.services.gmail._gmail_unread_ids",
            new_callable=AsyncMock,
            return_value=(["m1", "m2"], "hist-9"),
        ),
        patch(
            "star_itsm_api.services.gmail._gmail_get_json",
            new_callable=AsyncMock,
            side_effect=[{"id": "m1"}, {"id": "m2"}],
        ),
        patch(
            "star_itsm_api.services.gmail.parse_gmail_message",
            side_effect=[self_message, foreign_message],
        ),
    ):
        stats = await sync_gmail_inbox(
            mock_db,
            organization_id=org_id,
            actor_user_id=uuid.uuid4(),
        )

    assert stats.processed == 0
    assert stats.created_tickets == 0


@pytest.mark.asyncio
async def test_gmail_history_ids_parses_messages() -> None:
    with patch(
        "star_itsm_api.services.gmail._gmail_get_json",
        new_callable=AsyncMock,
        return_value={
            "historyId": "999",
            "history": [
                {"messagesAdded": [{"message": {"id": "a"}}, {"message": {"id": "b"}}]},
                {"messagesAdded": [{"message": {"id": "a"}}]},
            ],
        },
    ):
        ids, history = await _gmail_history_ids("token", "123")

    assert ids == ["a", "b"]
    assert history == "999"


@pytest.mark.asyncio
async def test_gmail_unread_ids_reads_profile_history() -> None:
    with patch(
        "star_itsm_api.services.gmail._gmail_get_json",
        new_callable=AsyncMock,
        side_effect=[
            {"messages": [{"id": "u1"}, {"id": ""}]},
            {"historyId": "555"},
        ],
    ):
        ids, history = await _gmail_unread_ids("token")

    assert ids == ["u1"]
    assert history == "555"


@pytest.mark.asyncio
async def test_mark_message_processed_swallows_api_error() -> None:
    with patch(
        "star_itsm_api.services.gmail._gmail_post_json",
        new_callable=AsyncMock,
        side_effect=GmailApiError("fail"),
    ):
        await _mark_message_processed("token", "msg-id")


@pytest.mark.asyncio
async def test_send_ticket_email_reply_mock_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "gmail_mock", True)
    ticket_id = uuid.uuid4()
    org_id = uuid.uuid4()
    ticket = Ticket(
        id=ticket_id,
        ticket_number="INC-2026-00042",
        title="Printer fejl",
        organization_id=org_id,
    )
    actor = SimpleNamespace(
        id=uuid.uuid4(),
        email="agent@example.dk",
        role="admin",
        organization_id=org_id,
    )
    latest = TicketEmail(
        ticket_id=ticket_id,
        gmail_thread_id="thread-1",
        from_email="kunde@example.com",
        subject="Printer fejl",
        internet_message_id="<prior@example.com>",
    )

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=_execute_result(latest))

    with (
        patch(
            "star_itsm_api.services.gmail.get_user_organization_id",
            return_value=org_id,
        ),
        patch(
            "star_itsm_api.services.gmail.get_email_integration",
            new_callable=AsyncMock,
            return_value=None,
        ),
    ):
        row = await send_ticket_email_reply(
            mock_db,
            ticket=ticket,
            actor=actor,
            body="Vi arbejder på sagen.",
        )

    assert row.direction == "outbound"
    assert "INC-2026-00042" in row.body_text
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_send_ticket_email_reply_real_requires_thread() -> None:
    ticket = Ticket(
        id=uuid.uuid4(),
        ticket_number="INC-2026-00042",
        title="Printer fejl",
        organization_id=uuid.uuid4(),
    )
    actor = SimpleNamespace(
        id=uuid.uuid4(),
        email="agent@example.dk",
        role="admin",
        organization_id=ticket.organization_id,
    )
    integration = EmailIntegration(
        organization_id=ticket.organization_id,
        provider="gmail",
        refresh_token_encrypted="plain:token",
        connected_email="desk@example.dk",
    )
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=_execute_result(None))

    with (
        patch.object(settings, "gmail_mock", False),
        patch(
            "star_itsm_api.services.gmail.get_user_organization_id",
            return_value=ticket.organization_id,
        ),
        patch(
            "star_itsm_api.services.gmail.get_email_integration",
            new_callable=AsyncMock,
            return_value=integration,
        ),
        patch(
            "star_itsm_api.services.gmail.refresh_access_token",
            new_callable=AsyncMock,
            return_value="access-token",
        ),
        pytest.raises(GmailApiError, match="ingen e-mail tråd"),
    ):
        await send_ticket_email_reply(
            mock_db,
            ticket=ticket,
            actor=actor,
            body="Hej",
        )


@pytest.mark.asyncio
async def test_list_ticket_emails_orders_results() -> None:
    ticket_id = uuid.uuid4()
    rows = [
        TicketEmail(ticket_id=ticket_id, received_at=datetime(2026, 1, 1, tzinfo=UTC)),
        TicketEmail(ticket_id=ticket_id, received_at=datetime(2026, 1, 2, tzinfo=UTC)),
    ]
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = rows
    mock_db.execute = AsyncMock(return_value=mock_result)

    listed = await list_ticket_emails(mock_db, ticket_id=ticket_id)

    assert len(listed) == 2
    assert listed[0].received_at < listed[1].received_at


@pytest.mark.asyncio
async def test_send_ticket_email_reply_real_path(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "gmail_mock", False)
    monkeypatch.setattr(settings, "gmail_allow_plaintext_tokens", True)
    org_id = uuid.uuid4()
    ticket = Ticket(
        id=uuid.uuid4(),
        ticket_number="INC-2026-00042",
        title="Printer fejl",
        organization_id=org_id,
    )
    actor = SimpleNamespace(
        id=uuid.uuid4(),
        email="agent@example.dk",
        role="admin",
        organization_id=org_id,
    )
    integration = EmailIntegration(
        organization_id=org_id,
        provider="gmail",
        refresh_token_encrypted="plain:token",
        connected_email="desk@example.dk",
    )
    latest = TicketEmail(
        ticket_id=ticket.id,
        gmail_thread_id="thread-1",
        from_email="kunde@example.com",
        subject="Printer fejl",
        internet_message_id="<prior@example.com>",
    )
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=_execute_result(latest))

    with (
        patch(
            "star_itsm_api.services.gmail.get_user_organization_id",
            return_value=org_id,
        ),
        patch(
            "star_itsm_api.services.gmail.get_email_integration",
            new_callable=AsyncMock,
            return_value=integration,
        ),
        patch(
            "star_itsm_api.services.gmail.refresh_access_token",
            new_callable=AsyncMock,
            return_value="access-token",
        ),
        patch(
            "star_itsm_api.services.gmail._gmail_post_json",
            new_callable=AsyncMock,
            return_value={"id": "sent-1", "threadId": "thread-1"},
        ),
    ):
        row = await send_ticket_email_reply(
            mock_db,
            ticket=ticket,
            actor=actor,
            body="Vi har løst problemet.",
        )

    assert row.gmail_message_id == "sent-1"
    assert row.direction == "outbound"
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_send_ticket_email_reply_mock_not_connected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "gmail_mock", False)
    ticket = Ticket(
        id=uuid.uuid4(),
        ticket_number="INC-2026-00042",
        title="Printer fejl",
        organization_id=uuid.uuid4(),
    )
    actor = SimpleNamespace(
        id=uuid.uuid4(),
        email="agent@example.dk",
        role="admin",
        organization_id=ticket.organization_id,
    )
    mock_db = AsyncMock()

    with (
        patch(
            "star_itsm_api.services.gmail.get_user_organization_id",
            return_value=ticket.organization_id,
        ),
        patch(
            "star_itsm_api.services.gmail.get_email_integration",
            new_callable=AsyncMock,
            return_value=None,
        ),
        pytest.raises(GmailApiError, match="ikke forbundet"),
    ):
        await send_ticket_email_reply(
            mock_db,
            ticket=ticket,
            actor=actor,
            body="Hej",
        )


@pytest.mark.asyncio
async def test_store_ticket_email_normalizes_comma_recipients() -> None:
    from star_itsm_api.services.gmail import _store_ticket_email

    mock_db = AsyncMock()
    message = _inbound(to_email="a@example.dk, b@example.dk , ")
    row = _store_ticket_email(
        mock_db,
        organization_id=uuid.uuid4(),
        ticket_id=uuid.uuid4(),
        message=message,
        direction="inbound",
    )
    assert row.to_email == "a@example.dk, b@example.dk"
