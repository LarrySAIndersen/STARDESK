from unittest.mock import AsyncMock, MagicMock

import pytest

from star_itsm_api.services import workboard_service


@pytest.mark.asyncio
async def test_next_task_number_increments_max() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one=lambda: 41))

    number = await workboard_service._next_task_number(mock_db)

    assert number == 42


@pytest.mark.asyncio
async def test_get_task_by_canvas_id_not_found() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        return_value=MagicMock(scalar_one_or_none=lambda: None),
    )

    with pytest.raises(LookupError, match="missing-id"):
        await workboard_service.get_task_by_canvas_id(mock_db, "missing-id")


@pytest.mark.asyncio
async def test_resolve_parent_id_returns_none_for_empty() -> None:
    mock_db = AsyncMock()
    parent = await workboard_service._resolve_parent_id(mock_db, None)
    assert parent is None
    mock_db.execute.assert_not_awaited()
