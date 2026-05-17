import uuid
from collections.abc import AsyncIterator
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from star_itsm_api.core.security import hash_password, verify_password
from star_itsm_api.deps import require_db
from star_itsm_api.main import app

KNOWN_PASSWORD = "Stardesk2026!"
NEW_PASSWORD = "NyAdgang2026!"
TEST_EMAIL = "sf01@example.dk"


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


@pytest.mark.asyncio
async def test_change_password_success(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    user = SimpleNamespace(
        id=uuid.uuid4(),
        email=TEST_EMAIL,
        password_hash=hash_password(KNOWN_PASSWORD),
        is_active=True,
        deleted_at=None,
    )

    with patch(
        "star_itsm_api.routers.auth.get_user_by_email",
        new_callable=AsyncMock,
        return_value=user,
    ):
        response = await api_client.post(
            "/api/v1/auth/change-password",
            json={
                "email": TEST_EMAIL,
                "current_password": KNOWN_PASSWORD,
                "new_password": NEW_PASSWORD,
            },
        )

    assert response.status_code == 204
    assert verify_password(NEW_PASSWORD, user.password_hash)
    override_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_change_password_wrong_current(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    user = SimpleNamespace(
        id=uuid.uuid4(),
        email=TEST_EMAIL,
        password_hash=hash_password(KNOWN_PASSWORD),
        is_active=True,
        deleted_at=None,
    )

    with patch(
        "star_itsm_api.routers.auth.get_user_by_email",
        new_callable=AsyncMock,
        return_value=user,
    ):
        response = await api_client.post(
            "/api/v1/auth/change-password",
            json={
                "email": TEST_EMAIL,
                "current_password": "ForkertKode2026!",
                "new_password": NEW_PASSWORD,
            },
        )

    assert response.status_code == 401
    assert response.json()["detail"] == "Forkert e-mail eller nuværende adgangskode"
    assert verify_password(KNOWN_PASSWORD, user.password_hash)
    override_db.commit.assert_not_awaited()
