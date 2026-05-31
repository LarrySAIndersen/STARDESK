from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from star_itsm_api.deps import require_db
from star_itsm_api.main import app
from star_itsm_api.schemas.user_admin import UserImportResult
from star_itsm_api.services.user_import import (
    normalize_import_role,
    parse_import_is_active,
)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Agent", "agent"),
        ("sagsbehandler", "agent"),
        ("Slutbruger", "end_user"),
        ("topadministrator", "top_admin"),
        ("Supporter", "supporter"),
        (None, "end_user"),
    ],
)
def test_normalize_import_role(raw: str | None, expected: str) -> None:
    assert normalize_import_role(raw, default_role="end_user") == expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("ja", True),
        ("inaktiv", False),
        ("", True),
        (True, True),
    ],
)
def test_parse_import_is_active(raw: str | bool | None, expected: bool) -> None:
    assert parse_import_is_active(raw) is expected


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
async def api_client(override_db: AsyncMock) -> AsyncClient:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.mark.asyncio
async def test_import_users_success(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    sample = UserImportResult(
        total=2,
        created=1,
        updated=1,
        skipped=0,
        failed=0,
        errors=[],
    )
    with patch(
        "star_itsm_api.routers.users.import_users_admin",
        new_callable=AsyncMock,
        return_value=sample,
    ):
        response = await api_client.post(
            "/api/v1/users/import",
            json={
                "rows": [
                    {
                        "email": "ny@example.dk",
                        "display_name": "Ny Bruger",
                    },
                    {
                        "email": "eksisterer@example.dk",
                        "display_name": "Opdateret",
                        "role": "agent",
                    },
                ],
                "default_role": "end_user",
                "on_duplicate": "update",
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["created"] == 1
    assert body["updated"] == 1
