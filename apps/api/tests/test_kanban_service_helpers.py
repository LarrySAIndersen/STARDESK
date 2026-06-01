import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from star_itsm_api.models.kanban import KanbanBoard
from star_itsm_api.services import kanban_service


def test_board_summary_maps_team_and_role() -> None:
    board = KanbanBoard()
    board.id = uuid.uuid4()
    board.name = "Drift board"
    board.description = "Team kanban"
    board.team_id = uuid.uuid4()
    board.created_by_user_id = uuid.uuid4()
    board.created_at = datetime(2026, 6, 1, tzinfo=UTC)
    board.updated_at = datetime(2026, 6, 1, tzinfo=UTC)

    summary = kanban_service._board_summary(board, team_name="Drift", my_role="editor")

    assert summary.name == "Drift board"
    assert summary.team_name == "Drift"
    assert summary.my_role == "editor"


@pytest.mark.asyncio
async def test_ticket_in_board_scope_team_match() -> None:
    team_id = uuid.uuid4()
    board = SimpleNamespace(team_id=team_id)
    ticket = SimpleNamespace(assigned_team_id=team_id)

    assert await kanban_service._ticket_in_board_scope(board, ticket) is True


@pytest.mark.asyncio
async def test_ticket_in_board_scope_open_board() -> None:
    board = SimpleNamespace(team_id=None)
    ticket = SimpleNamespace(assigned_team_id=uuid.uuid4())

    assert await kanban_service._ticket_in_board_scope(board, ticket) is True


@pytest.mark.asyncio
async def test_next_card_position_increments() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one=lambda: 4))

    position = await kanban_service._next_card_position(
        mock_db,
        board_id=uuid.uuid4(),
        column_id=uuid.uuid4(),
    )

    assert position == 5
