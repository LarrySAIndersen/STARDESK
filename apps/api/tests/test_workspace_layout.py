"""API tests for workspace landing layout persistence."""

import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from star_itsm_api.core.security import (
    ROLE_AGENT,
    get_current_user,
    get_current_user_session,
)
from star_itsm_api.main import app
from star_itsm_api.schemas.workspace_layout import WorkspaceLandingRead, WorkspaceLandingLayout
from star_itsm_api.services import workspace_layout_service


@pytest.fixture(autouse=True)
def _use_mock_db(override_db: AsyncMock) -> None:
    pass


@pytest.fixture
async def unauthenticated_client(override_db: AsyncMock) -> AsyncIterator[AsyncClient]:
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_current_user_session, None)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


def _user(*, role: str) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        email="agent@example.dk",
        display_name="Test Agent",
        role=role,
        is_active=True,
        password_hash=None,
        deleted_at=None,
        must_change_password=False,
        password_policy_exempt=False,
    )


@pytest.mark.asyncio
async def test_get_workspace_landing_requires_auth(
    unauthenticated_client: AsyncClient,
) -> None:
    response = await unauthenticated_client.get("/api/v1/workspace/landing")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_workspace_landing_returns_defaults(
    api_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _user(role=ROLE_AGENT)

    def _as_user():
        return user

    app.dependency_overrides[get_current_user] = _as_user
    app.dependency_overrides[get_current_user_session] = _as_user

    now = datetime.now(UTC)
    default_layout = workspace_layout_service.DEFAULT_WORKSPACE_LAYOUT.model_copy(deep=True)
    monkeypatch.setattr(
        workspace_layout_service,
        "get_workspace_landing",
        AsyncMock(
            return_value=WorkspaceLandingRead(
                user_id=user.id,
                layout=default_layout,
                layout_version=1,
                updated_at=now,
            ),
        ),
    )

    response = await api_client.get("/api/v1/workspace/landing")
    assert response.status_code == 200
    body = response.json()
    assert body["user_id"] == str(user.id)
    assert len(body["layout"]["personal"]) == 5
    assert len(body["layout"]["team"]) == 4


@pytest.mark.asyncio
async def test_put_workspace_landing_persists_layout(
    api_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _user(role=ROLE_AGENT)

    def _as_user():
        return user

    app.dependency_overrides[get_current_user] = _as_user
    app.dependency_overrides[get_current_user_session] = _as_user

    saved_layout = WorkspaceLandingLayout(
        personal=[
            {
                "instance_id": "personal-dashboard-0",
                "kind": "personal-dashboard",
                "order": 0,
                "span": "full",
                "hidden": False,
            },
        ],
        team=[],
    )
    now = datetime.now(UTC)
    monkeypatch.setattr(
        workspace_layout_service,
        "save_workspace_landing",
        AsyncMock(
            return_value=WorkspaceLandingRead(
                user_id=user.id,
                layout=saved_layout,
                layout_version=1,
                updated_at=now,
            ),
        ),
    )

    response = await api_client.put(
        "/api/v1/workspace/landing",
        json={"layout": saved_layout.model_dump()},
    )
    assert response.status_code == 200
    assert response.json()["layout"]["personal"][0]["kind"] == "personal-dashboard"
