"""Unit tests for ticket watch (interested stakeholder) service."""

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.user import User
from star_itsm_api.services import ticket_watch_service as svc


def _user() -> User:
    return User(
        id=uuid.uuid4(),
        email="agent@example.dk",
        display_name="Anna",
        role="agent",
        is_active=True,
    )


def _ticket(ticket_id: uuid.UUID | None = None) -> Ticket:
    return Ticket(
        id=ticket_id or uuid.uuid4(),
        ticket_number="INC-00001",
        title="Test sag",
        status="new",
        priority="medium",
        reporter_user_id=uuid.uuid4(),
        deleted_at=None,
    )


@pytest.mark.asyncio
async def test_watch_ticket_not_found() -> None:
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)
    with pytest.raises(LookupError, match="ticket_not_found"):
        await svc.watch_ticket(mock_db, _user(), uuid.uuid4())


@pytest.mark.asyncio
async def test_watch_ticket_upserts_interested() -> None:
    user = _user()
    ticket = _ticket()
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=ticket)

    with (
        patch.object(svc, "user_can_access_ticket", new=AsyncMock(return_value=True)),
        patch.object(svc, "upsert_stakeholder", new=AsyncMock()) as mock_upsert,
    ):
        await svc.watch_ticket(mock_db, user, ticket.id)

    mock_upsert.assert_awaited_once()
    assert mock_upsert.await_args.kwargs["role"] == "interested"
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_list_watch_updates_empty_without_watched() -> None:
    mock_db = AsyncMock()
    with patch.object(svc, "list_watched_ticket_ids", new=AsyncMock(return_value=[])):
        rows = await svc.list_watch_updates(
            mock_db,
            _user(),
            since=datetime(2026, 1, 1, tzinfo=UTC),
        )
    assert rows == []


def test_event_summary_da_status() -> None:
    text = svc._event_summary_da("ticket.status_changed", {"status": "in_progress"})
    assert "in_progress" in text
