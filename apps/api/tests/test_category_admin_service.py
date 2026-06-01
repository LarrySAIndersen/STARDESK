import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from star_itsm_api.schemas.category_admin import CategoryCreate, CategoryUpdate, SubcategoryCreate
from star_itsm_api.services import category_admin


@pytest.mark.asyncio
async def test_create_category_conflict_returns_409() -> None:
    existing = MagicMock()
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: existing))

    with pytest.raises(HTTPException) as exc:
        await category_admin.create_category(
            mock_db,
            CategoryCreate(name="hardware", name_da="Hardware", sort_order=1, is_active=True),
        )
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_update_category_not_found() -> None:
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)

    with pytest.raises(HTTPException) as exc:
        await category_admin.update_category(
            mock_db,
            uuid.uuid4(),
            CategoryUpdate(name_da="Opdateret"),
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_create_subcategory_missing_category() -> None:
    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=None)

    with pytest.raises(HTTPException) as exc:
        await category_admin.create_subcategory(
            mock_db,
            SubcategoryCreate(
                category_id=uuid.uuid4(),
                name="general",
                name_da="Generelt",
                sort_order=1,
                is_active=True,
            ),
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_list_categories_admin_empty() -> None:
    empty = MagicMock()
    empty.scalars.return_value.all.return_value = []
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=empty)

    rows = await category_admin.list_categories_admin(mock_db)

    assert rows == []
