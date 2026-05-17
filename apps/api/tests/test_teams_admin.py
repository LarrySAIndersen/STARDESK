import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from star_itsm_api.core.security import ROLE_AGENT, get_current_user
from star_itsm_api.deps import require_db
from star_itsm_api.main import app
from star_itsm_api.schemas.team import TeamMemberRead, TeamRead

TEAM_ID = uuid.UUID("a1000001-0000-4000-8000-000000000001")
USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000041")


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
async def test_patch_team_members_forbidden_for_agent(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    app.dependency_overrides[get_current_user] = _fake_agent_user
    try:
        response = await api_client.patch(
            f"/api/v1/teams/{TEAM_ID}",
            json={"user_ids": [str(USER_ID)]},
        )
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_patch_team_members_success(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    team = SimpleNamespace(
        id=TEAM_ID,
        name="SF",
        description="Hovedgruppe",
        is_active=True,
    )
    override_db.get = AsyncMock(return_value=team)

    detail = TeamRead(
        id=TEAM_ID,
        name="SF",
        description="Hovedgruppe",
        is_active=True,
        members=[
            TeamMemberRead(
                user_id=USER_ID,
                display_name="Anna",
                email="sf01@example.dk",
                role="top_admin",
                role_label="Topadministrator",
                joined_at=datetime(2026, 1, 1, tzinfo=UTC),
            )
        ],
    )

    with (
        patch(
            "star_itsm_api.routers.teams.sync_team_members",
            new_callable=AsyncMock,
        ) as sync_mock,
        patch(
            "star_itsm_api.routers.teams.build_team_read",
            new_callable=AsyncMock,
            return_value=detail,
        ),
    ):
        response = await api_client.patch(
            f"/api/v1/teams/{TEAM_ID}",
            json={"user_ids": [str(USER_ID)]},
        )

    assert response.status_code == 200
    sync_mock.assert_awaited_once()
    body = response.json()
    assert body["name"] == "SF"
    assert len(body["members"]) == 1
