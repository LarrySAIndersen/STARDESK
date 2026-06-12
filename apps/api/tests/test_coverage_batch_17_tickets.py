"""Batch 17 — ticket router helpers and metadata mutations."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from star_itsm_api.routers.tickets import _ensure_ticket_access, _apply_metadata_classification
from tests.conftest import FAKE_ADMIN


@pytest.mark.asyncio
async def test_ensure_ticket_access_raises_404_when_denied() -> None:
    ticket = SimpleNamespace(id=uuid.uuid4())
    with patch(
        "star_itsm_api.routers.tickets.user_can_access_ticket",
        AsyncMock(return_value=False),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await _ensure_ticket_access(AsyncMock(), ticket, FAKE_ADMIN)
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_apply_metadata_classification_updates_category() -> None:
    mock_db = AsyncMock()
    category_id = uuid.uuid4()
    ticket = SimpleNamespace(category_id=None, subcategory_id=None)
    with patch(
        "star_itsm_api.routers.tickets.validate_ticket_classification",
        AsyncMock(),
    ) as mock_validate:
        await _apply_metadata_classification(
            mock_db,
            ticket,
            {"category_id": category_id},
            FAKE_ADMIN,
        )
    mock_validate.assert_awaited_once()
    assert ticket.category_id == category_id


@pytest.mark.asyncio
async def test_apply_metadata_classification_forbidden_for_end_user() -> None:
    end_user = SimpleNamespace(role="end_user")
    ticket = SimpleNamespace(category_id=None, subcategory_id=None)
    with pytest.raises(HTTPException) as exc_info:
        await _apply_metadata_classification(
            AsyncMock(),
            ticket,
            {"category_id": uuid.uuid4()},
            end_user,
        )
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_apply_ticket_metadata_updates_tags() -> None:
    from star_itsm_api.routers.tickets import _apply_ticket_metadata_updates

    ticket = SimpleNamespace(
        is_major=False,
        is_shared=False,
        is_security_ticket=False,
        parent_ticket_id=None,
        category_id=None,
        subcategory_id=None,
        tags=None,
        emoji=None,
        source="portal",
    )
    with patch(
        "star_itsm_api.routers.tickets.require_staff_for_security_metadata_update",
    ):
        await _apply_ticket_metadata_updates(
            AsyncMock(),
            ticket,
            {"tags": ["printer", "urgent"], "emoji": "printer"},
            FAKE_ADMIN,
        )
    assert ticket.tags == ["printer", "urgent"]
    assert ticket.emoji == "printer"
