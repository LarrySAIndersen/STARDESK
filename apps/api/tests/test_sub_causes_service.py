import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from star_itsm_api.models.sub_cause import SubCause
from star_itsm_api.services import sub_causes


@pytest.mark.asyncio
async def test_list_sub_causes_all() -> None:
    sub1 = SubCause(id=uuid.uuid4(), name="Sub 1", name_da="Sub 1 DA", is_active=True, sort_order=1, category_id=None)
    sub2 = SubCause(id=uuid.uuid4(), name="Sub 2", name_da="Sub 2 DA", is_active=True, sort_order=2, category_id=uuid.uuid4())
    
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [sub1, sub2]
    
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result)
    
    result = await sub_causes.list_sub_causes(mock_db)
    assert len(result) == 2
    assert result[0].name == "Sub 1"
    assert result[1].name == "Sub 2"


@pytest.mark.asyncio
async def test_list_sub_causes_with_category() -> None:
    cat_id = uuid.uuid4()
    sub1 = SubCause(id=uuid.uuid4(), name="Sub 1", name_da="Sub 1 DA", is_active=True, sort_order=1, category_id=cat_id)
    
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [sub1]
    
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result)
    
    result = await sub_causes.list_sub_causes(mock_db, category_id=cat_id)
    assert len(result) == 1
    assert result[0].name == "Sub 1"


@pytest.mark.asyncio
async def test_get_sub_causes_by_ticket_ids_empty() -> None:
    mock_db = AsyncMock()
    result = await sub_causes.get_sub_causes_by_ticket_ids(mock_db, [])
    assert result == {}
    mock_db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_get_sub_causes_by_ticket_ids_with_data() -> None:
    ticket_id = uuid.uuid4()
    sub = SubCause(id=uuid.uuid4(), name="Sub 1", name_da="Sub 1 DA", is_active=True, sort_order=1, category_id=None)
    
    mock_result = MagicMock()
    mock_result.all.return_value = [(ticket_id, sub)]
    
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result)
    
    result = await sub_causes.get_sub_causes_by_ticket_ids(mock_db, [ticket_id])
    assert len(result) == 1
    assert result[ticket_id][0].name == "Sub 1"


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


@pytest.mark.asyncio
async def test_validate_sub_cause_ids_success_with_category() -> None:
    category_id = uuid.uuid4()
    sub_cause_id1 = uuid.uuid4()
    sub_cause_id2 = uuid.uuid4()
    row1 = MagicMock(id=sub_cause_id1, category_id=category_id)
    row2 = MagicMock(id=sub_cause_id2, category_id=None)

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: [row1, row2]))
    )

    await sub_causes.validate_sub_cause_ids(
        mock_db,
        [sub_cause_id1, sub_cause_id2],
        category_id=category_id,
    )


@pytest.mark.asyncio
async def test_validate_sub_cause_ids_success_with_no_category() -> None:
    sub_cause_id = uuid.uuid4()
    row = MagicMock(id=sub_cause_id, category_id=uuid.uuid4())

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: [row]))
    )

    await sub_causes.validate_sub_cause_ids(
        mock_db,
        [sub_cause_id],
        category_id=None,
    )


@pytest.mark.asyncio
async def test_replace_ticket_sub_causes() -> None:
    ticket_id = uuid.uuid4()
    sub_cause_id = uuid.uuid4()
    
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock()
    mock_db.add = MagicMock()
    
    await sub_causes.replace_ticket_sub_causes(mock_db, ticket_id, [sub_cause_id])
    
    mock_db.execute.assert_awaited_once()
    mock_db.add.assert_called_once()
