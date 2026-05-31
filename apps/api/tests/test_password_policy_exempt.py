import uuid
from collections.abc import AsyncIterator
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from star_itsm_api.core.password_policy import effective_must_change_password
from star_itsm_api.core.security import ensure_password_changed, hash_password
from star_itsm_api.deps import require_db
from star_itsm_api.main import app
from star_itsm_api.models.user import User
from tests.prototype_test_credentials import KNOWN_PASSWORD, NEW_INVALID_PASSWORD

NEW_PASSWORD = NEW_INVALID_PASSWORD
TEST_EMAIL = "exempt@example.dk"


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


def test_effective_must_change_password_respects_exempt() -> None:
    user = SimpleNamespace(
        must_change_password=True,
        password_policy_exempt=True,
    )
    assert effective_must_change_password(user) is False


def test_ensure_password_changed_skips_exempt_user() -> None:
    user = User(
        id=uuid.uuid4(),
        email=TEST_EMAIL,
        display_name="Exempt",
        role="agent",
        is_active=True,
        password_hash=hash_password(KNOWN_PASSWORD),
        must_change_password=True,
        password_policy_exempt=True,
    )
    ensure_password_changed(user)


@pytest.mark.asyncio
async def test_change_password_exempt_skips_complexity(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    user = SimpleNamespace(
        id=uuid.uuid4(),
        email=TEST_EMAIL,
        password_hash=hash_password(KNOWN_PASSWORD),
        is_active=True,
        deleted_at=None,
        must_change_password=True,
        password_policy_exempt=True,
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
    assert user.must_change_password is False
    override_db.commit.assert_awaited_once()
