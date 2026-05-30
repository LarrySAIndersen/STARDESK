import uuid
from collections.abc import AsyncIterator
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from star_itsm_api.deps import require_db
from star_itsm_api.main import app
from star_itsm_api.models.workboard import WorkboardTask
from star_itsm_api.services import workboard_service
from star_itsm_api.services.workboard_mapping import row_to_canvas_dict


def _sample_row(*, canvas_id: str = "t-64", number: int = 64) -> WorkboardTask:
    now = workboard_service._now()
    return WorkboardTask(
        id=uuid.uuid4(),
        canvas_id=canvas_id,
        number=number,
        title="Work Board DB persistence",
        description="Foundation task",
        status="Review",
        priority="P0",
        owner="",
        tags="workboard,db,api",
        source="Backlog",
        parent_id=None,
        parent_canvas_id=None,
        extra={"reviewVerificationScope": "cursor"},
        field_history={},
        activity_log=[],
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )


@pytest.fixture
def mock_db() -> AsyncMock:
    session = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.flush = AsyncMock()
    return session


@pytest.fixture
async def api_client(mock_db: AsyncMock) -> AsyncIterator[AsyncClient]:
    async def _require_db() -> AsyncMock:
        return mock_db

    app.dependency_overrides[require_db] = _require_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.pop(require_db, None)


@pytest.mark.asyncio
async def test_list_workboard_tasks_without_database_returns_503(client: AsyncClient) -> None:
    response = await client.get("/api/v1/workboard/tasks")
    assert response.status_code == 503


def test_row_to_canvas_dict_roundtrip() -> None:
    row = _sample_row()
    payload = row_to_canvas_dict(row)
    assert payload["id"] == "t-64"
    assert payload["number"] == 64
    assert payload["status"] == "Review"
    assert payload["reviewVerificationScope"] == "cursor"


@pytest.mark.asyncio
async def test_list_workboard_tasks_happy_path(
    api_client: AsyncClient,
    mock_db: AsyncMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    row = _sample_row()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [row]
    mock_db.execute = AsyncMock(return_value=mock_result)

    async def _list_tasks(_db: AsyncMock, *, status: str | None = None) -> list:
        assert status is None
        return [workboard_service._read_from_row(row)]

    monkeypatch.setattr(workboard_service, "list_tasks", _list_tasks)

    response = await api_client.get("/api/v1/workboard/tasks")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == "t-64"
    assert body[0]["number"] == 64


@pytest.mark.asyncio
async def test_bulk_import_happy_path(
    api_client: AsyncClient,
    mock_db: AsyncMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _bulk_import(
        _db: AsyncMock,
        tasks: list,
        *,
        replace_missing: bool = False,
    ):
        assert len(tasks) == 1
        assert tasks[0]["id"] == "t-1"
        assert replace_missing is False
        from star_itsm_api.schemas.workboard import WorkboardBulkImportResult

        return WorkboardBulkImportResult(created=1, updated=0)

    monkeypatch.setattr(workboard_service, "bulk_import", _bulk_import)

    response = await api_client.post(
        "/api/v1/workboard/tasks/bulk-import",
        json={"tasks": [{"id": "t-1", "number": 1, "title": "Test", "status": "Backlog"}]},
    )
    assert response.status_code == 200
    assert response.json()["created"] == 1
