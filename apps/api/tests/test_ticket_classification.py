import uuid
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from star_itsm_api.models.category import Category, Subcategory
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.services.ticket_classification import (
    validate_ticket_classification,
    validate_ticket_source_value,
)
from star_itsm_api.services.ticket_search import apply_ticket_search_filter


def test_apply_ticket_search_filter_skips_blank_query() -> None:
    base = select(Ticket)
    assert apply_ticket_search_filter(base, None) is base
    assert apply_ticket_search_filter(base, "   ") is base


def test_apply_ticket_search_filter_adds_predicate() -> None:
    base = select(Ticket)
    filtered = apply_ticket_search_filter(base, "printer")
    assert filtered is not base


@pytest.mark.asyncio
async def test_validate_ticket_classification_subcategory_without_category() -> None:
    mock_db = AsyncMock()
    with pytest.raises(HTTPException) as exc:
        await validate_ticket_classification(
            mock_db,
            category_id=None,
            subcategory_id=uuid.uuid4(),
        )
    assert exc.value.status_code == 400
    assert "kategori" in exc.value.detail.lower()


@pytest.mark.asyncio
async def test_validate_ticket_classification_both_none() -> None:
    mock_db = AsyncMock()
    # Should not raise any exception and should not make any DB calls
    await validate_ticket_classification(mock_db, category_id=None, subcategory_id=None)
    mock_db.get.assert_not_called()


@pytest.mark.asyncio
async def test_validate_ticket_classification_valid() -> None:
    mock_db = AsyncMock()
    cat_id = uuid.uuid4()
    sub_id = uuid.uuid4()

    mock_category = Category(id=cat_id, is_active=True)
    mock_subcategory = Subcategory(id=sub_id, category_id=cat_id, is_active=True)

    # Mock db.get to return valid category and subcategory
    async def mock_get(model, ident):
        if model == Category:
            return mock_category
        if model == Subcategory:
            return mock_subcategory
        return None

    mock_db.get.side_effect = mock_get

    # Should not raise any exception
    await validate_ticket_classification(mock_db, category_id=cat_id, subcategory_id=sub_id)


@pytest.mark.asyncio
async def test_validate_ticket_classification_invalid_category() -> None:
    mock_db = AsyncMock()
    cat_id = uuid.uuid4()

    # Case 1: Category not found
    mock_db.get.return_value = None
    with pytest.raises(HTTPException) as exc:
        await validate_ticket_classification(mock_db, category_id=cat_id, subcategory_id=None)
    assert exc.value.status_code == 400
    assert "ugyldig kategori" in exc.value.detail.lower()

    # Case 2: Category inactive
    mock_category = Category(id=cat_id, is_active=False)
    mock_db.get.return_value = mock_category
    with pytest.raises(HTTPException) as exc:
        await validate_ticket_classification(mock_db, category_id=cat_id, subcategory_id=None)
    assert exc.value.status_code == 400
    assert "ugyldig kategori" in exc.value.detail.lower()


@pytest.mark.asyncio
async def test_validate_ticket_classification_invalid_subcategory() -> None:
    mock_db = AsyncMock()
    cat_id = uuid.uuid4()
    sub_id = uuid.uuid4()

    mock_category = Category(id=cat_id, is_active=True)

    # Case 1: Subcategory not found
    async def mock_get_none(model, ident):
        if model == Category:
            return mock_category
        return None

    mock_db.get.side_effect = mock_get_none
    with pytest.raises(HTTPException) as exc:
        await validate_ticket_classification(mock_db, category_id=cat_id, subcategory_id=sub_id)
    assert exc.value.status_code == 400
    assert "ugyldig underkategori" in exc.value.detail.lower()

    # Case 2: Subcategory inactive
    mock_subcategory_inactive = Subcategory(id=sub_id, category_id=cat_id, is_active=False)
    async def mock_get_inactive(model, ident):
        if model == Category:
            return mock_category
        if model == Subcategory:
            return mock_subcategory_inactive
        return None

    mock_db.get.side_effect = mock_get_inactive
    with pytest.raises(HTTPException) as exc:
        await validate_ticket_classification(mock_db, category_id=cat_id, subcategory_id=sub_id)
    assert exc.value.status_code == 400
    assert "ugyldig underkategori" in exc.value.detail.lower()

    # Case 3: Subcategory belongs to different category
    mock_subcategory_wrong_cat = Subcategory(id=sub_id, category_id=uuid.uuid4(), is_active=True)
    async def mock_get_wrong_cat(model, ident):
        if model == Category:
            return mock_category
        if model == Subcategory:
            return mock_subcategory_wrong_cat
        return None

    mock_db.get.side_effect = mock_get_wrong_cat
    with pytest.raises(HTTPException) as exc:
        await validate_ticket_classification(mock_db, category_id=cat_id, subcategory_id=sub_id)
    assert exc.value.status_code == 400
    assert "ugyldig underkategori" in exc.value.detail.lower()


def test_validate_ticket_source_value_valid() -> None:
    # Should not raise any exception for a valid source
    validate_ticket_source_value("portal")


def test_validate_ticket_source_value_invalid() -> None:
    with pytest.raises(HTTPException) as exc:
        validate_ticket_source_value("invalid_source")
    assert exc.value.status_code == 400
    assert "ugyldig kilde" in exc.value.detail.lower()
