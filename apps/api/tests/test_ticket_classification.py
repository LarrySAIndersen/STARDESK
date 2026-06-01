import uuid
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from star_itsm_api.models.ticket import Ticket
from star_itsm_api.services.ticket_classification import validate_ticket_classification
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
