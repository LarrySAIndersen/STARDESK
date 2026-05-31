import uuid
from collections.abc import AsyncIterator
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from star_itsm_api.core.config import settings
from star_itsm_api.core.security import (
    create_access_token,
    get_current_user,
    get_current_user_session,
)
from star_itsm_api.deps import require_db
from star_itsm_api.main import app
from star_itsm_api.models.user import User
from tests.prototype_test_credentials import BOOTSTRAP_HASH

USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000099")


@pytest.fixture
def pending_user() -> User:
    return User(
        id=USER_ID,
        email="pending@example.dk",
        display_name="Pending User",
        role="agent",
        is_active=True,
        password_hash=BOOTSTRAP_HASH,
        organization_id=None,
        deleted_at=None,
        must_change_password=True,
    )


@pytest.fixture
async def authed_client(
    monkeypatch: pytest.MonkeyPatch,
    pending_user: User,
) -> AsyncIterator[AsyncClient]:
    monkeypatch.setattr(settings, "jwt_secret", "test-jwt-secret-for-must-change-32")

    async def _fake_session() -> User:
        return pending_user

    async def _fake_db() -> AsyncMock:
        db = AsyncMock()
        db.get = AsyncMock(return_value=pending_user)
        empty_rows = MagicMock()
        empty_rows.scalars.return_value.all.return_value = []
        db.execute = AsyncMock(return_value=empty_rows)
        return db

    # conftest autouse overrides get_current_user with admin; use real Option A logic here
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides[get_current_user_session] = _fake_session
    app.dependency_overrides[require_db] = _fake_db

    token = create_access_token(
        user_id=pending_user.id,
        role=pending_user.role,
        email=pending_user.email,
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Authorization": f"Bearer {token}"},
    ) as client:
        yield client

    app.dependency_overrides.pop(get_current_user_session, None)
    app.dependency_overrides.pop(require_db, None)
    # conftest autouse will restore get_current_user override after the test


@pytest.mark.asyncio
async def test_must_change_password_allows_get_categories(
    authed_client: AsyncClient,
) -> None:
    response = await authed_client.get("/api/v1/categories")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_must_change_password_blocks_post_mutation(
    authed_client: AsyncClient,
) -> None:
    response = await authed_client.post(
        "/api/v1/knowledge-articles",
        json={
            "title": "Test article",
            "description": "Long enough body text for validation",
            "knowledge_status": "draft",
            "knowledge_visibility": "internal",
        },
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "must_change_password"


@pytest.mark.asyncio
async def test_must_change_password_allows_me(
    authed_client: AsyncClient,
) -> None:
    response = await authed_client.get("/api/v1/auth/me")
    assert response.status_code == 200
    assert response.json()["must_change_password"] is True


@pytest.mark.asyncio
async def test_must_change_password_blocks_patch_teams_with_agent_role(
    authed_client: AsyncClient,
    pending_user: User,
) -> None:
    pending_user.role = "agent"
    response = await authed_client.patch(
        "/api/v1/teams/a1000001-0000-4000-8000-000000000001",
        json={"user_ids": []},
    )
    assert response.status_code == 403
    assert response.json()["detail"] != "must_change_password"
