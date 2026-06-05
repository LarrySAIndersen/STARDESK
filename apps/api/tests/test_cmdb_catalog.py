import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from star_itsm_api.models.cmdb_catalog import CmdbCatalog
from star_itsm_api.models.user import User
from star_itsm_api.schemas.cmdb import CmdbCatalogPayload, CmdbCatalogWrite
from star_itsm_api.services.cmdb_catalog import get_catalog, save_catalog


@pytest.mark.asyncio
async def test_get_catalog_empty() -> None:
    mock_db = AsyncMock()
    mock_db.get.return_value = None

    result = await get_catalog(mock_db)

    assert result.updated_at is None
    assert result.payload.systems == []
    mock_db.get.assert_awaited_once_with(CmdbCatalog, 1)


@pytest.mark.asyncio
async def test_get_catalog_existing() -> None:
    mock_db = AsyncMock()
    now = datetime.now(UTC)
    payload_dict = {
        "systems": [{"id": "sys-1", "name": "System 1"}],
        "extra_edges": [],
        "removed_edge_ids": [],
        "deleted_asset_ids": [],
        "metadata": {},
    }
    mock_row = CmdbCatalog(id=1, payload=payload_dict, updated_at=now)
    mock_db.get.return_value = mock_row

    result = await get_catalog(mock_db)

    assert result.updated_at == now
    assert len(result.payload.systems) == 1
    assert result.payload.systems[0]["id"] == "sys-1"


@pytest.mark.asyncio
async def test_save_catalog_new() -> None:
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_db.get.return_value = None

    actor = User(id=uuid.uuid4(), email="larrysanders@example.dk")
    payload = CmdbCatalogPayload(systems=[{"id": "sys-2", "name": "System 2"}])
    body = CmdbCatalogWrite(payload=payload)

    # Mock refresh to do nothing
    async def mock_refresh(row):
        pass
    mock_db.refresh.side_effect = mock_refresh

    result = await save_catalog(mock_db, actor=actor, body=body)

    assert result.updated_at is not None
    assert len(result.payload.systems) == 1
    assert result.payload.systems[0]["id"] == "sys-2"
    mock_db.add.assert_called_once()
    mock_db.commit.assert_awaited_once()
    mock_db.refresh.assert_awaited_once()


@pytest.mark.asyncio
async def test_save_catalog_existing() -> None:
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    now_old = datetime(2026, 1, 1, tzinfo=UTC)
    mock_row = CmdbCatalog(
        id=1,
        payload={"systems": []},
        updated_at=now_old,
        updated_by=uuid.uuid4(),
    )
    mock_db.get.return_value = mock_row

    actor = User(id=uuid.uuid4(), email="larrysanders@example.dk")
    payload = CmdbCatalogPayload(systems=[{"id": "sys-3", "name": "System 3"}])
    body = CmdbCatalogWrite(payload=payload)

    async def mock_refresh(row):
        pass
    mock_db.refresh.side_effect = mock_refresh

    result = await save_catalog(mock_db, actor=actor, body=body)

    assert result.updated_at is not None
    assert result.updated_at != now_old
    assert len(result.payload.systems) == 1
    assert result.payload.systems[0]["id"] == "sys-3"
    mock_db.add.assert_not_called()
    mock_db.commit.assert_awaited_once()
    mock_db.refresh.assert_awaited_once_with(mock_row)
