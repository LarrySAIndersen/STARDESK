import uuid
from collections.abc import AsyncIterator
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from star_itsm_api.core.security import ROLE_AGENT, ROLE_TOP_ADMIN, get_current_user
from star_itsm_api.deps import require_db
from star_itsm_api.main import app
from star_itsm_api.schemas.user_admin import (
    UserAdminListItem,
    UserAdminListResponse,
    UserAdminRead,
    UserTeamSummary,
)

TARGET_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000041")


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


async def _fake_agent_user() -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        email="agent@example.dk",
        display_name="Agent",
        role=ROLE_AGENT,
        is_active=True,
        password_hash=None,
        deleted_at=None,
        organization_id=None,
    )


@pytest.mark.asyncio
async def test_list_users_forbidden_for_agent(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    app.dependency_overrides[get_current_user] = _fake_agent_user
    try:
        response = await api_client.get("/api/v1/users")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_list_users_success(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    sample = UserAdminListResponse(
        items=[
            UserAdminListItem(
                id=TARGET_USER_ID,
                email="sf01@example.dk",
                display_name="Anna",
                role="top_admin",
                role_label="Topadministrator",
                is_active=True,
                organization_name=None,
                team_names=["SF"],
            )
        ],
        total=1,
        page=1,
        page_size=50,
    )
    with patch(
        "star_itsm_api.routers.users.list_users_admin",
        new_callable=AsyncMock,
        return_value=sample,
    ):
        response = await api_client.get("/api/v1/users?q=anna")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["email"] == "sf01@example.dk"


@pytest.mark.asyncio
async def test_reset_password_success(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    user = SimpleNamespace(
        id=TARGET_USER_ID,
        email="sf01@example.dk",
        display_name="Anna",
        role=ROLE_TOP_ADMIN,
        is_active=True,
        password_hash="old",
        deleted_at=None,
        organization_id=None,
    )
    override_db.get = AsyncMock(return_value=user)

    with patch(
        "star_itsm_api.routers.users.set_user_password",
        new_callable=AsyncMock,
    ) as reset_mock:
        response = await api_client.post(
            f"/api/v1/users/{TARGET_USER_ID}/reset-password",
            json={"new_password": "NyAdgang2026!"},
        )

    assert response.status_code == 204
    reset_mock.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_user_assign_top_admin_forbidden_for_admin(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    user = SimpleNamespace(
        id=TARGET_USER_ID,
        email="sf04@example.dk",
        display_name="Dorte",
        role="agent",
        is_active=True,
        password_hash=None,
        deleted_at=None,
        organization_id=None,
    )
    override_db.get = AsyncMock(return_value=user)

    response = await api_client.patch(
        f"/api/v1/users/{TARGET_USER_ID}",
        json={"role": "top_admin"},
    )

    assert response.status_code == 403
    override_db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_get_user_success(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    detail = UserAdminRead(
        id=TARGET_USER_ID,
        email="sf01@example.dk",
        display_name="Anna",
        role="top_admin",
        role_label="Topadministrator",
        is_active=True,
        teams=[UserTeamSummary(id=uuid.uuid4(), name="SF")],
    )
    with patch(
        "star_itsm_api.routers.users.get_user_admin",
        new_callable=AsyncMock,
        return_value=detail,
    ):
        response = await api_client.get(f"/api/v1/users/{TARGET_USER_ID}")

    assert response.status_code == 200
    assert response.json()["display_name"] == "Anna"
