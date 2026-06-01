import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from star_itsm_api.services import sub_causes


@pytest.mark.asyncio
async def test_get_sub_causes_by_ticket_ids_empty() -> None:
    mock_db = AsyncMock()
    result = await sub_causes.get_sub_causes_by_ticket_ids(mock_db, [])
    assert result == {}
    mock_db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_validate_sub_cause_ids_empty_ok() -> None:
    mock_db = AsyncMock()
    await sub_causes.validate_sub_cause_ids(mock_db, [], category_id=None)
    mock_db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_validate_sub_cause_ids_unknown_id() -> None:
    missing_id = uuid.uuid4()
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: [])))

    with pytest.raises(HTTPException) as exc:
        await sub_causes.validate_sub_cause_ids(mock_db, [missing_id], category_id=None)

    assert exc.value.status_code == 400
    assert exc.value.detail == "Invalid sub-cause"


@pytest.mark.asyncio
async def test_validate_sub_cause_ids_category_mismatch() -> None:
    category_id = uuid.uuid4()
    other_category = uuid.uuid4()
    sub_cause_id = uuid.uuid4()
    row = MagicMock(id=sub_cause_id, category_id=other_category)

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: [row]))
    )

    with pytest.raises(HTTPException) as exc:
        await sub_causes.validate_sub_cause_ids(
            mock_db,
            [sub_cause_id],
            category_id=category_id,
        )

    assert exc.value.status_code == 400
    assert "category" in str(exc.value.detail).lower()
