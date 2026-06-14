"""Unit tests for staff in-app notification service."""

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.ticket_event import TicketEvent
from star_itsm_api.models.user import User
from star_itsm_api.schemas.staff_notification import StaffNotificationKind
from star_itsm_api.services import staff_notification_service as svc


def _staff_user() -> User:
    return User(
        id=uuid.uuid4(),
        email="agent@example.dk",
        display_name="Anna",
        role="agent",
        is_active=True,
    )


def _ticket(
    *,
    ticket_id: uuid.UUID | None = None,
    assigned_user_id: uuid.UUID | None = None,
    assigned_team_id: uuid.UUID | None = None,
) -> Ticket:
    now = datetime(2026, 6, 1, 8, 0, tzinfo=UTC)
    return Ticket(
        id=ticket_id or uuid.uuid4(),
        ticket_number="INC-00042",
        title="Netværksfejl",
        status="assigned",
        priority="high",
        reporter_user_id=uuid.uuid4(),
        assigned_user_id=assigned_user_id,
        assigned_team_id=assigned_team_id,
        assigned_at=now,
        created_at=now,
        resolution_due_at=now + timedelta(hours=8),
        deleted_at=None,
    )


def test_sla_milestone_summary_da() -> None:
    assert "50%" in svc._sla_milestone_summary_da(50)
    assert "100%" in svc._sla_milestone_summary_da(100)
    assert "25%" in svc._sla_milestone_summary_da(125)


def test_assignment_changed_to_user() -> None:
    user_id = uuid.uuid4()
    payload = {
        "previous": {"assigned_user_id": None},
        "assigned_user_id": str(user_id),
    }
    assert svc._assignment_changed_to_user(payload, user_id) is True
    payload["previous"]["assigned_user_id"] = str(user_id)
    assert svc._assignment_changed_to_user(payload, user_id) is False


@pytest.mark.asyncio
async def test_list_staff_notifications_empty_for_non_staff() -> None:
    submitter = User(
        id=uuid.uuid4(),
        email="borger@example.dk",
        display_name="Borger",
        role="submitter",
        is_active=True,
    )
    rows = await svc.list_staff_notifications(
        AsyncMock(),
        submitter,
        since=datetime(2026, 1, 1, tzinfo=UTC),
    )
    assert rows == []


@pytest.mark.asyncio
async def test_sla_milestone_notifications_at_threshold() -> None:
    user = _staff_user()
    ticket = _ticket(assigned_user_id=user.id)
    since = ticket.created_at
    now = ticket.created_at + timedelta(hours=4, minutes=1)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [ticket]
    mock_db.execute = AsyncMock(return_value=mock_result)

    with patch.object(
        svc,
        "effective_resolution_due_at",
        return_value=ticket.resolution_due_at,
    ):
        rows = await svc._sla_milestone_notifications(
            mock_db,
            ticket_ids={ticket.id},
            since=since,
            now=now,
        )

    kinds = {row.sla_percent for row in rows}
    assert 50 in kinds


@pytest.mark.asyncio
async def test_assignment_notification_assigned_to_me() -> None:
    user = _staff_user()
    ticket = _ticket()
    event = TicketEvent()
    event.id = uuid.uuid4()
    event.ticket_id = ticket.id
    event.actor_user_id = uuid.uuid4()
    event.event_type = "ticket.assigned"
    event.created_at = datetime(2026, 6, 2, 10, 0, tzinfo=UTC)
    event.payload = {
        "previous": {"assigned_user_id": None},
        "assigned_user_id": str(user.id),
        "assigned_team_id": None,
    }

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.all.return_value = [(event, ticket.ticket_number, ticket.title)]
    mock_db.execute = AsyncMock(return_value=mock_result)

    rows = await svc._assignment_notifications(
        mock_db,
        user,
        team_ids=set(),
        since=datetime(2026, 6, 1, tzinfo=UTC),
        limit=10,
    )
    assert len(rows) == 1
    assert rows[0].kind == StaffNotificationKind.ASSIGNED_TO_ME
    assert "tildelt dig" in rows[0].summary_da.lower()
