import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from star_itsm_api.models.category import Category, Subcategory
from star_itsm_api.schemas.category_admin import (
    CategoryCreate,
    CategoryUpdate,
    SubcategoryCreate,
    SubcategoryUpdate,
)
from star_itsm_api.services import category_admin
from star_itsm_api.services.category_defaults import DefaultCategory, DefaultSubcategory


@pytest.mark.asyncio
async def test_list_categories_admin_with_data() -> None:
    mock_db = AsyncMock()
    cat_id = uuid.uuid4()
    cat = Category(id=cat_id, name="hardware", name_da="Hardware", sort_order=1, is_active=True)
    sub = Subcategory(id=uuid.uuid4(), category_id=cat_id, name="pc", name_da="PC", sort_order=1, is_active=True)
    
    cat_result = MagicMock()
    cat_result.scalars.return_value.all.return_value = [cat]
    
    sub_result = MagicMock()
    sub_result.scalars.return_value.all.return_value = [sub]
    
    mock_db.execute.side_effect = [cat_result, sub_result]
    
    result = await category_admin.list_categories_admin(mock_db)
    assert len(result) == 1
    assert result[0].name == "hardware"
    assert len(result[0].subcategories) == 1
    assert result[0].subcategories[0].name == "pc"


@pytest.mark.asyncio
async def test_create_category_success() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: None))
    
    payload = CategoryCreate(name="hardware", name_da="Hardware", sort_order=1, is_active=True)
    result = await category_admin.create_category(mock_db, payload)
    
    assert result.name == "hardware"
    mock_db.add.assert_called_once()
    mock_db.commit.assert_awaited_once()
    mock_db.refresh.assert_awaited_once()


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
async def test_update_category_success() -> None:
    mock_db = AsyncMock()
    cat_id = uuid.uuid4()
    cat = Category(id=cat_id, name="hardware", name_da="Hardware", sort_order=1, is_active=True)
    mock_db.get.return_value = cat
    
    # Mock clash check to return None
    clash_result = MagicMock()
    clash_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = clash_result
    
    with patch("star_itsm_api.services.category_admin.list_categories_admin") as mock_list:
        mock_list.return_value = [
            category_admin.CategoryAdminRead(
                id=cat_id, name="hardware_new", name_da="Hardware Opdateret", sort_order=1, is_active=True, subcategories=[]
            )
        ]
        
        result = await category_admin.update_category(
            mock_db,
            cat_id,
            CategoryUpdate(name="hardware_new", name_da="Hardware Opdateret"),
        )
        
        assert result.name == "hardware_new"
        assert cat.name == "hardware_new"
        assert cat.name_da == "Hardware Opdateret"
        mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_category_clash() -> None:
    mock_db = AsyncMock()
    cat_id = uuid.uuid4()
    cat = Category(id=cat_id, name="hardware", name_da="Hardware", sort_order=1, is_active=True)
    mock_db.get.return_value = cat
    
    # Mock clash check to return another category
    clash_result = MagicMock()
    clash_result.scalar_one_or_none.return_value = Category(id=uuid.uuid4(), name="other")
    mock_db.execute.return_value = clash_result
    
    with pytest.raises(HTTPException) as exc:
        await category_admin.update_category(
            mock_db,
            cat_id,
            CategoryUpdate(name="other"),
        )
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_update_category_missing_after_save() -> None:
    mock_db = AsyncMock()
    cat_id = uuid.uuid4()
    cat = Category(id=cat_id, name="hardware", name_da="Hardware", sort_order=1, is_active=True)
    mock_db.get.return_value = cat
    
    clash_result = MagicMock()
    clash_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = clash_result
    
    with patch("star_itsm_api.services.category_admin.list_categories_admin") as mock_list:
        mock_list.return_value = []
        
        with pytest.raises(HTTPException) as exc:
            await category_admin.update_category(
                mock_db,
                cat_id,
                CategoryUpdate(name_da="Hardware Opdateret"),
            )
        assert exc.value.status_code == 500


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
async def test_create_subcategory_success() -> None:
    mock_db = AsyncMock()
    cat_id = uuid.uuid4()
    cat = Category(id=cat_id, name="hardware", name_da="Hardware", sort_order=1, is_active=True)
    mock_db.get.return_value = cat
    
    clash_result = MagicMock()
    clash_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = clash_result
    
    payload = SubcategoryCreate(category_id=cat_id, name="pc", name_da="PC", sort_order=1, is_active=True)
    result = await category_admin.create_subcategory(mock_db, payload)
    
    assert result.name == "pc"
    mock_db.add.assert_called_once()
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_subcategory_clash() -> None:
    mock_db = AsyncMock()
    cat_id = uuid.uuid4()
    cat = Category(id=cat_id, name="hardware", name_da="Hardware", sort_order=1, is_active=True)
    mock_db.get.return_value = cat
    
    clash_result = MagicMock()
    clash_result.scalar_one_or_none.return_value = Subcategory(id=uuid.uuid4())
    mock_db.execute.return_value = clash_result
    
    payload = SubcategoryCreate(category_id=cat_id, name="pc", name_da="PC", sort_order=1, is_active=True)
    with pytest.raises(HTTPException) as exc:
        await category_admin.create_subcategory(mock_db, payload)
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_update_subcategory_not_found() -> None:
    mock_db = AsyncMock()
    mock_db.get.return_value = None
    
    with pytest.raises(HTTPException) as exc:
        await category_admin.update_subcategory(mock_db, uuid.uuid4(), SubcategoryUpdate(name_da="PC Opdateret"))
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_update_subcategory_success() -> None:
    mock_db = AsyncMock()
    sub_id = uuid.uuid4()
    sub = Subcategory(id=sub_id, category_id=uuid.uuid4(), name="pc", name_da="PC", sort_order=1, is_active=True)
    mock_db.get.return_value = sub
    
    clash_result = MagicMock()
    clash_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = clash_result
    
    result = await category_admin.update_subcategory(
        mock_db,
        sub_id,
        SubcategoryUpdate(name="pc_new", name_da="PC Opdateret"),
    )
    
    assert result.name == "pc_new"
    assert sub.name == "pc_new"
    assert sub.name_da == "PC Opdateret"
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_subcategory_no_name_change() -> None:
    mock_db = AsyncMock()
    sub_id = uuid.uuid4()
    sub = Subcategory(id=sub_id, category_id=uuid.uuid4(), name="pc", name_da="PC", sort_order=1, is_active=True)
    mock_db.get.return_value = sub
    
    result = await category_admin.update_subcategory(
        mock_db,
        sub_id,
        SubcategoryUpdate(name_da="PC Opdateret Only"),
    )
    
    assert result.name == "pc"
    assert sub.name_da == "PC Opdateret Only"
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_subcategory_clash() -> None:
    mock_db = AsyncMock()
    sub_id = uuid.uuid4()
    sub = Subcategory(id=sub_id, category_id=uuid.uuid4(), name="pc", name_da="PC", sort_order=1, is_active=True)
    mock_db.get.return_value = sub
    
    clash_result = MagicMock()
    clash_result.scalar_one_or_none.return_value = Subcategory(id=uuid.uuid4())
    mock_db.execute.return_value = clash_result
    
    with pytest.raises(HTTPException) as exc:
        await category_admin.update_subcategory(
            mock_db,
            sub_id,
            SubcategoryUpdate(name="clash"),
        )
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_list_categories_admin_empty() -> None:
    empty = MagicMock()
    empty.scalars.return_value.all.return_value = []
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=empty)

    rows = await category_admin.list_categories_admin(mock_db)

    assert rows == []


@pytest.mark.asyncio
async def test_sync_default_categories() -> None:
    mock_db = AsyncMock()
    
    # Mock select Category to return None (so Category is created)
    cat_check_result = MagicMock()
    cat_check_result.scalar_one_or_none.return_value = None
    
    # Mock select Subcategory to return None (so Subcategory is created)
    sub_check_result = MagicMock()
    sub_check_result.scalar_one_or_none.return_value = None
    
    # Mock final Category list count
    total_result = MagicMock()
    total_result.scalars.return_value.all.return_value = [Category(id=uuid.uuid4())]
    
    mock_db.execute.side_effect = [
        cat_check_result, sub_check_result,
        total_result
    ]
    
    # We patch DEFAULT_CATEGORIES to have exactly 1 spec for simpler testing
    specs = [
        DefaultCategory(
            name="hardware",
            name_da="Hardware",
            sort_order=1,
            subcategories=(
                DefaultSubcategory(name="pc", name_da="PC", sort_order=1),
            )
        )
    ]
    
    with patch("star_itsm_api.services.category_admin.DEFAULT_CATEGORIES", specs):
        result = await category_admin.sync_default_categories(mock_db)
        assert result.categories_created == 1
        assert result.subcategories_created == 1
        assert result.categories_total == 1
        mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_sync_default_categories_existing() -> None:
    mock_db = AsyncMock()
    
    # Mock select Category to return existing Category (inactive)
    existing_cat = Category(id=uuid.uuid4(), name="hardware", name_da="Old Hardware", sort_order=5, is_active=False)
    cat_check_result = MagicMock()
    cat_check_result.scalar_one_or_none.return_value = existing_cat
    
    # Mock select Subcategory to return existing Subcategory (inactive)
    existing_sub = Subcategory(id=uuid.uuid4(), category_id=existing_cat.id, name="pc", name_da="Old PC", sort_order=5, is_active=False)
    sub_check_result = MagicMock()
    sub_check_result.scalar_one_or_none.return_value = existing_sub
    
    # Mock final Category list count
    total_result = MagicMock()
    total_result.scalars.return_value.all.return_value = [existing_cat]
    
    mock_db.execute.side_effect = [
        cat_check_result, sub_check_result,
        total_result
    ]
    
    specs = [
        DefaultCategory(
            name="hardware",
            name_da="Hardware",
            sort_order=1,
            subcategories=(
                DefaultSubcategory(name="pc", name_da="PC", sort_order=1),
            )
        )
    ]
    
    with patch("star_itsm_api.services.category_admin.DEFAULT_CATEGORIES", specs):
        result = await category_admin.sync_default_categories(mock_db)
        assert result.categories_created == 0
        assert result.subcategories_created == 0
        assert existing_cat.is_active is True
        assert existing_cat.name_da == "Hardware"
        assert existing_cat.sort_order == 1
        assert existing_sub.is_active is True
        assert existing_sub.name_da == "PC"
        assert existing_sub.sort_order == 1
        mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_sync_default_categories_existing_active() -> None:
    mock_db = AsyncMock()
    
    # Mock select Category to return existing Category (active)
    existing_cat = Category(id=uuid.uuid4(), name="hardware", name_da="Hardware", sort_order=1, is_active=True)
    cat_check_result = MagicMock()
    cat_check_result.scalar_one_or_none.return_value = existing_cat
    
    # Mock select Subcategory to return existing Subcategory (active)
    existing_sub = Subcategory(id=uuid.uuid4(), category_id=existing_cat.id, name="pc", name_da="PC", sort_order=1, is_active=True)
    sub_check_result = MagicMock()
    sub_check_result.scalar_one_or_none.return_value = existing_sub
    
    # Mock final Category list count
    total_result = MagicMock()
    total_result.scalars.return_value.all.return_value = [existing_cat]
    
    mock_db.execute.side_effect = [
        cat_check_result, sub_check_result,
        total_result
    ]
    
    specs = [
        DefaultCategory(
            name="hardware",
            name_da="Hardware",
            sort_order=1,
            subcategories=(
                DefaultSubcategory(name="pc", name_da="PC", sort_order=1),
            )
        )
    ]
    
    with patch("star_itsm_api.services.category_admin.DEFAULT_CATEGORIES", specs):
        result = await category_admin.sync_default_categories(mock_db)
        assert result.categories_created == 0
        assert result.subcategories_created == 0
        assert existing_cat.is_active is True
        assert existing_sub.is_active is True
        mock_db.commit.assert_awaited_once()
