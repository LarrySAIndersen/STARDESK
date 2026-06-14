"""Tests for configurable case-type catalog."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from star_itsm_api.schemas.case_types import CaseTypeCatalogUpdate, CaseTypeEntry
from star_itsm_api.services.case_types import (
    DEFAULT_CASE_TYPES,
    get_case_type_catalog,
    get_enabled_case_types,
    set_case_type_catalog,
    validate_ticket_type_id,
)


def test_default_catalog_has_three_types() -> None:
    catalog = CaseTypeCatalogUpdate(items=list(DEFAULT_CASE_TYPES))
    assert len(catalog.items) == 3
    assert {item.id for item in catalog.items} == {"incident", "service_request", "problem"}


@pytest.mark.asyncio
async def test_get_case_type_catalog_without_db() -> None:
    catalog = await get_case_type_catalog(None)
    assert catalog.source == "defaults"
    assert len(catalog.items) == 3


@pytest.mark.asyncio
async def test_validate_ticket_type_rejects_unknown() -> None:
    db = AsyncMock()
    db.get = AsyncMock(return_value=None)
    with pytest.raises(HTTPException) as exc:
        await validate_ticket_type_id(db, "change")
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_set_case_type_catalog_persists_and_syncs_constraints() -> None:
    db = AsyncMock()
    db.get = AsyncMock(return_value=None)
    db.add = MagicMock()
    db.execute = AsyncMock()
    db.commit = AsyncMock()

    payload = CaseTypeCatalogUpdate(
        items=[
            *DEFAULT_CASE_TYPES,
            CaseTypeEntry(
                id="change",
                label_da="Ændring",
                prefix="CHG",
                description_da="Planlagt ændring.",
                allowed_priorities=["high", "medium", "low"],
                allowed_statuses=["new", "assigned", "in_progress", "closed"],
            ),
        ]
    )
    result = await set_case_type_catalog(db, payload)
    assert any(item.id == "change" for item in result.items)
    assert db.execute.await_count >= 2
    db.commit.assert_awaited_once()


def test_get_enabled_case_types_filters_disabled() -> None:
    from star_itsm_api.schemas.case_types import CaseTypeCatalogRead

    catalog = CaseTypeCatalogRead(
        items=[
            DEFAULT_CASE_TYPES[0],
            DEFAULT_CASE_TYPES[1].model_copy(update={"enabled": False}),
            DEFAULT_CASE_TYPES[2],
        ]
    )
    enabled = get_enabled_case_types(catalog)
    assert {entry.id for entry in enabled} == {"incident", "problem"}
