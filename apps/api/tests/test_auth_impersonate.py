import uuid
from collections.abc import AsyncIterator
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from star_itsm_api.core.config import settings
from star_itsm_api.core.security import create_access_token, decode_access_token
from star_itsm_api.deps import require_db
from star_itsm_api.main import app
from star_itsm_api.models.user import User
from star_itsm_api.routers import auth as auth_router
from star_itsm_api.services.user_roles import attach_roles_to_user

ADMIN_ID = uuid.UUID("00000000-0000-0000-0000-000000000030")
TARGET_ID = uuid.UUID("00000000-0000-0000-0000-000000000031")


def _user(
    *,
    user_id: uuid.UUID,
    email: str,
    display_name: str,
    role: str,
) -> User:
    user = User(
        id=user_id,
        email=email,
        display_name=display_name,
        role=role,
        is_active=True,
        password_hash=None,
        organization_id=None,
        deleted_at=None,
        must_change_password=False,
    )
    attach_roles_to_user(user, [role])
    return user


@pytest.fixture
def admin_user() -> User:
    return _user(
        user_id=ADMIN_ID,
        email="admin@example.dk",
        display_name="Admin Bruger",
        role="admin",
    )


@pytest.fixture
def target_user() -> User:
    return _user(
        user_id=TARGET_ID,
        email="anna@example.dk",
        display_name="Anna Agent",
        role="agent",
    )


@pytest.fixture
async def impersonate_client(
    monkeypatch: pytest.MonkeyPatch,
    admin_user: User,
    target_user: User,
) -> AsyncIterator[AsyncClient]:
    from star_itsm_api.core.security import get_current_user, get_current_user_session

    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_current_user_session, None)

    monkeypatch.setattr(
        settings,
        "jwt_secret",
        "test-jwt-secret-for-impersonate-tests-32",
    )
    monkeypatch.setattr(
        auth_router,
        "enforce_sole_top_admin_on_login",
        AsyncMock(return_value=None),
    )
    monkeypatch.setattr(
        auth_router,
        "ensure_user_roles_loaded",
        AsyncMock(side_effect=lambda _db, user: [user.role]),
    )

    async def _fake_get(db: AsyncMock, user_id: uuid.UUID) -> User | None:
        if user_id == ADMIN_ID:
            return admin_user
        if user_id == TARGET_ID:
            return target_user
        return None

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(side_effect=_fake_get)

    def _require_db() -> AsyncMock:
        return mock_db

    app.dependency_overrides[require_db] = _require_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.pop(require_db, None)


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_impersonate_requires_auth(impersonate_client: AsyncClient) -> None:
    response = await impersonate_client.post(
        "/api/v1/auth/impersonate",
        json={"user_id": str(TARGET_ID)},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_impersonate_forbidden_for_non_admin(
    impersonate_client: AsyncClient,
    target_user: User,
) -> None:
    token = create_access_token(
        user_id=target_user.id,
        role=target_user.role,
        email=target_user.email,
    )
    response = await impersonate_client.post(
        "/api/v1/auth/impersonate",
        json={"user_id": str(ADMIN_ID)},
        headers=_auth_headers(token),
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_impersonate_issues_token_for_target_user(
    impersonate_client: AsyncClient,
    admin_user: User,
    target_user: User,
) -> None:
    admin_token = create_access_token(
        user_id=admin_user.id,
        role=admin_user.role,
        email=admin_user.email,
    )
    response = await impersonate_client.post(
        "/api/v1/auth/impersonate",
        json={"user_id": str(target_user.id)},
        headers=_auth_headers(admin_token),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["id"] == str(target_user.id)
    assert body["user"]["email"] == target_user.email
    assert body["user"]["impersonator"]["id"] == str(admin_user.id)

    payload = decode_access_token(body["access_token"])
    assert payload["sub"] == str(target_user.id)
    assert payload["impersonator_id"] == str(admin_user.id)
    assert payload["must_change_password"] is False


@pytest.mark.asyncio
async def test_stop_impersonate_restores_admin(
    impersonate_client: AsyncClient,
    admin_user: User,
    target_user: User,
) -> None:
    impersonation_token = create_access_token(
        user_id=target_user.id,
        role=target_user.role,
        email=target_user.email,
        impersonator_id=admin_user.id,
    )
    response = await impersonate_client.post(
        "/api/v1/auth/stop-impersonate",
        headers=_auth_headers(impersonation_token),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["id"] == str(admin_user.id)
    assert body["user"].get("impersonator") is None

    payload = decode_access_token(body["access_token"])
    assert payload["sub"] == str(admin_user.id)
    assert "impersonator_id" not in payload


@pytest.mark.asyncio
async def test_stop_impersonate_requires_active_session(
    impersonate_client: AsyncClient,
    admin_user: User,
) -> None:
    token = create_access_token(
        user_id=admin_user.id,
        role=admin_user.role,
        email=admin_user.email,
    )
    response = await impersonate_client.post(
        "/api/v1/auth/stop-impersonate",
        headers=_auth_headers(token),
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_me_includes_impersonator(
    impersonate_client: AsyncClient,
    admin_user: User,
    target_user: User,
) -> None:
    impersonation_token = create_access_token(
        user_id=target_user.id,
        role=target_user.role,
        email=target_user.email,
        impersonator_id=admin_user.id,
    )

    response = await impersonate_client.get(
        "/api/v1/auth/me",
        headers=_auth_headers(impersonation_token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(target_user.id)
    assert body["impersonator"]["id"] == str(admin_user.id)
