import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from star_itsm_api.core.constants import SYSTEM_USER_ID
from star_itsm_api.models.user import User
from star_itsm_api.services import ticket_read


def test_fallback_ticket_read_minimal_payload() -> None:
    ticket = SimpleNamespace(
        id=uuid.uuid4(),
        ticket_number="INC-2026-00001",
        title="Printer virker ikke",
        status="new",
        priority="medium",
        ticket_type="incident",
        is_major=False,
        is_shared=False,
        is_security_ticket=False,
        parent_ticket_id=None,
        assigned_team_id=None,
        reporter_user_id=uuid.uuid4(),
        response_due_at=None,
        resolution_due_at=None,
        created_at=datetime(2026, 6, 1, tzinfo=UTC),
        updated_at=None,
        fault_displayed=False,
        tags=[],
        emoji=None,
        source="portal",
    )
    read = ticket_read._fallback_ticket_read(ticket, reporter_display_name="Anna")
    assert read.ticket_number == "INC-2026-00001"
    assert read.reporter_display_name == "Anna"
    assert read.source == "portal"


@pytest.mark.asyncio
async def test_load_user_display_names_empty_set() -> None:
    mock_db = AsyncMock()
    names = await ticket_read.load_user_display_names(mock_db, set())
    assert names == {}
    mock_db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_load_user_display_names_includes_system_user() -> None:
    user = User()
    user.id = uuid.uuid4()
    user.display_name = "Borger"

    result = MagicMock()
    result.scalars.return_value.all.return_value = [user]
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=result)

    names = await ticket_read.load_user_display_names(mock_db, {user.id, SYSTEM_USER_ID})

    assert names[user.id] == "Borger"
    assert names[SYSTEM_USER_ID] == "System"


@pytest.mark.asyncio
async def test_load_user_display_names_on_failure_still_maps_system() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=RuntimeError("timeout"))
    mock_db.rollback = AsyncMock()

    names = await ticket_read.load_user_display_names(mock_db, {SYSTEM_USER_ID})

    assert names == {SYSTEM_USER_ID: "System"}


@pytest.mark.asyncio
async def test_tickets_to_read_list_empty() -> None:
    mock_db = AsyncMock()
    reads = await ticket_read.tickets_to_read_list(mock_db, [])
    assert reads == []


@pytest.mark.asyncio
async def test_ticket_hierarchy_detail_extras_on_failure_returns_empty() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=RuntimeError("db"))
    mock_db.rollback = AsyncMock()
    ticket = SimpleNamespace(id=uuid.uuid4(), is_major=False, parent_ticket_id=None)

    extras = await ticket_read.ticket_hierarchy_detail_extras(mock_db, ticket)

    assert extras == {"children": [], "related_major_tickets": []}
