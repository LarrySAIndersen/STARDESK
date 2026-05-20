import uuid
from collections.abc import AsyncIterator
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from star_itsm_api.deps import require_db
from star_itsm_api.main import app
from star_itsm_api.services.category_admin import CategorySyncCounts
from star_itsm_api.services.category_bulk_assign import CategoryFillResult


@pytest.fixture
def mock_db() -> AsyncMock:
    session = AsyncMock()
    session.commit = AsyncMock()
    return session


@pytest.fixture
def override_db(mock_db: AsyncMock):
    async def _require_db() -> AsyncMock:
        return mock_db

    app.dependency_overrides[require_db] = _require_db
    yield mock_db
    app.dependency_overrides.pop(require_db, None)


@pytest.fixture
async def api_client(override_db: AsyncMock) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


async def _fake_admin() -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
        email="admin@example.dk",
        role="admin",
        organization_id=None,
        organization_name=None,
    )


@pytest.mark.asyncio
async def test_sync_default_categories(api_client: AsyncClient) -> None:
    from star_itsm_api.core.security import get_current_user

    app.dependency_overrides[get_current_user] = _fake_admin
    try:
        with patch(
            "star_itsm_api.routers.admin.sync_default_categories",
            new_callable=AsyncMock,
            return_value=CategorySyncCounts(
                categories_created=2,
                subcategories_created=10,
                categories_total=14,
            ),
        ):
            response = await api_client.post("/api/v1/admin/categories/sync-defaults")
        assert response.status_code == 200
        assert response.json()["categories_total"] == 14
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_fill_tickets_dry_run(api_client: AsyncClient) -> None:
    from star_itsm_api.core.security import get_current_user

    app.dependency_overrides[get_current_user] = _fake_admin
    try:
        with patch(
            "star_itsm_api.routers.admin.fill_tickets_missing_category",
            new_callable=AsyncMock,
            return_value=CategoryFillResult(
                ticket_count=3,
                updated_count=0,
                dry_run=True,
                category_name="other",
                subcategory_name="general",
            ),
        ):
            response = await api_client.post(
                "/api/v1/admin/categories/fill-tickets?dry_run=true",
            )
        assert response.status_code == 200
        data = response.json()
        assert data["dry_run"] is True
        assert data["ticket_count"] == 3
    finally:
        app.dependency_overrides.pop(get_current_user, None)
