"""Unit tests for star_itsm_api.services.category_bulk_assign."""

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from star_itsm_api.services import category_bulk_assign as cba


def _scalar_result(value: object) -> MagicMock:
    res = MagicMock()
    res.scalar_one_or_none.return_value = value
    return res


def _tickets_result(tickets: list[object]) -> MagicMock:
    res = MagicMock()
    res.scalars.return_value.all.return_value = tickets
    return res


@pytest.mark.asyncio
async def test_resolve_fill_targets_category_missing() -> None:
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalar_result(None))
    with pytest.raises(HTTPException) as exc:
        await cba._resolve_fill_targets(
            db, category_name="Standard", subcategory_name="Generelt"
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_resolve_fill_targets_subcategory_missing() -> None:
    db = AsyncMock()
    cat = SimpleNamespace(id=uuid.uuid4(), name="Standard")
    db.execute = AsyncMock(side_effect=[_scalar_result(cat), _scalar_result(None)])
    with pytest.raises(HTTPException) as exc:
        await cba._resolve_fill_targets(
            db, category_name="Standard", subcategory_name="Generelt"
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_resolve_fill_targets_success() -> None:
    db = AsyncMock()
    cat = SimpleNamespace(id=uuid.uuid4(), name="Standard")
    sub = SimpleNamespace(id=uuid.uuid4(), name="Generelt")
    db.execute = AsyncMock(side_effect=[_scalar_result(cat), _scalar_result(sub)])
    out_cat, out_sub = await cba._resolve_fill_targets(
        db, category_name="Standard", subcategory_name="Generelt"
    )
    assert out_cat is cat
    assert out_sub is sub


@pytest.mark.asyncio
async def test_fill_dry_run() -> None:
    db = AsyncMock()
    cat = SimpleNamespace(id=uuid.uuid4(), name="Standard")
    sub = SimpleNamespace(id=uuid.uuid4(), name="Generelt")
    db.execute = AsyncMock(
        side_effect=[
            _scalar_result(cat),
            _scalar_result(sub),
            _tickets_result([SimpleNamespace(), SimpleNamespace()]),
        ]
    )
    result = await cba.fill_tickets_missing_category(db, dry_run=True)
    assert result.dry_run is True
    assert result.ticket_count == 2
    assert result.updated_count == 0
    assert result.category_name == "Standard"
    assert result.subcategory_name == "Generelt"
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_fill_applies_sla_and_commits() -> None:
    db = AsyncMock()
    cat = SimpleNamespace(id=uuid.uuid4(), name="Standard")
    sub = SimpleNamespace(id=uuid.uuid4(), name="Generelt")
    ticket = SimpleNamespace(
        category_id=None,
        subcategory_id=None,
        created_at=datetime.now(UTC),
        updated_at=None,
    )
    db.execute = AsyncMock(
        side_effect=[_scalar_result(cat), _scalar_result(sub), _tickets_result([ticket])]
    )
    with patch.object(cba, "apply_sla_to_ticket", new=AsyncMock()) as sla_mock:
        result = await cba.fill_tickets_missing_category(
            db, dry_run=False, recalculate_sla=True
        )
    assert result.dry_run is False
    assert result.ticket_count == 1
    assert result.updated_count == 1
    assert ticket.category_id == cat.id
    assert ticket.subcategory_id == sub.id
    assert ticket.updated_at is not None
    sla_mock.assert_awaited_once()
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_fill_without_sla_recalc() -> None:
    db = AsyncMock()
    cat = SimpleNamespace(id=uuid.uuid4(), name="Standard")
    sub = SimpleNamespace(id=uuid.uuid4(), name="Generelt")
    ticket = SimpleNamespace(
        category_id=None,
        subcategory_id=None,
        created_at=datetime.now(UTC),
        updated_at=None,
    )
    db.execute = AsyncMock(
        side_effect=[_scalar_result(cat), _scalar_result(sub), _tickets_result([ticket])]
    )
    with patch.object(cba, "apply_sla_to_ticket", new=AsyncMock()) as sla_mock:
        result = await cba.fill_tickets_missing_category(
            db, dry_run=False, recalculate_sla=False
        )
    assert result.updated_count == 1
    sla_mock.assert_not_awaited()
    db.commit.assert_awaited_once()
