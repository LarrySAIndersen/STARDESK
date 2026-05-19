import uuid
from collections.abc import AsyncIterator
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from star_itsm_api.core.config import settings
from star_itsm_api.core.security import verify_password
from star_itsm_api.deps import require_db
from star_itsm_api.main import app
from star_itsm_api.models.user import User
from star_itsm_api.routers import auth as auth_router

LARRY_EMAIL = "larrysanders@example.dk"
LARRY_PASSWORD = "password"
LARRY_HASH = "$2b$12$R4g4tKPsO73abz4FuHtEXuYIwua1Rr3zsfp/N4x3R5h07rV33EzXC"
LARRY_ID = uuid.UUID("00000000-0000-0000-0000-000000000040")


def test_larry_seed_password_hash() -> None:
    assert verify_password(LARRY_PASSWORD, LARRY_HASH)


@pytest.fixture
def larry_user() -> User:
    return User(
        id=LARRY_ID,
        email=LARRY_EMAIL,
        display_name="Larrysanders",
        role="admin",
        is_active=True,
        password_hash=LARRY_HASH,
        organization_id=None,
        deleted_at=None,
        must_change_password=True,
    )


@pytest.fixture
async def login_client(
    monkeypatch: pytest.MonkeyPatch,
    larry_user: User,
) -> AsyncIterator[AsyncClient]:
    monkeypatch.setattr(
        settings,
        "jwt_secret",
        "test-jwt-secret-for-login-tests-only-32",
    )

    async def _fake_get_user_by_email(_db: object, email: str) -> User | None:
        if email == LARRY_EMAIL:
            return larry_user
        return None

    async def _fake_db() -> AsyncMock:
        return AsyncMock()

    monkeypatch.setattr(auth_router, "get_user_by_email", _fake_get_user_by_email)
    app.dependency_overrides[require_db] = _fake_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.pop(require_db, None)


@pytest.mark.asyncio
async def test_login_larry_sanders(login_client: AsyncClient) -> None:
    response = await login_client.post(
        "/api/v1/auth/login",
        json={"email": LARRY_EMAIL, "password": LARRY_PASSWORD},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["access_token"]
    assert body["user"]["email"] == LARRY_EMAIL
    assert body["user"]["role"] == "admin"
    assert body["user"]["must_change_password"] is True


@pytest.mark.asyncio
async def test_login_larry_wrong_password(login_client: AsyncClient) -> None:
    response = await login_client.post(
        "/api/v1/auth/login",
        json={"email": LARRY_EMAIL, "password": "wrong-password"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Forkert e-mail eller adgangskode"
