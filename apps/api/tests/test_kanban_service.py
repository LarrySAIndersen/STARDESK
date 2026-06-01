import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from star_itsm_api.models.kanban import KanbanColumn
from star_itsm_api.services import kanban_service


@pytest.mark.asyncio
async def test_load_member_maps_empty_board_list() -> None:
    mock_db = AsyncMock()
    roles, members = await kanban_service._load_member_maps(mock_db, [])
    assert roles == {}
    assert members == {}
    mock_db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_team_names_empty_set() -> None:
    mock_db = AsyncMock()
    names = await kanban_service._team_names(mock_db, set())
    assert names == {}
    mock_db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_list_board_columns_returns_ordered() -> None:
    board_id = uuid.uuid4()
    col = KanbanColumn()
    col.id = uuid.uuid4()
    col.board_id = board_id
    col.name = "Modtaget"
    col.position = 0

    result = MagicMock()
    result.scalars.return_value.all.return_value = [col]
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=result)

    columns = await kanban_service._list_board_columns(mock_db, board_id)
    assert len(columns) == 1
    assert columns[0].name == "Modtaget"
