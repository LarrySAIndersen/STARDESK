import uuid
from collections.abc import AsyncIterator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from star_itsm_api.core.security import ROLE_AGENT, get_current_user
from star_itsm_api.deps import require_db
from star_itsm_api.main import app
from star_itsm_api.models.user import User
from star_itsm_api.services.org_access import (
    IntegrationOrganizationError,
    resolve_integration_organization_id,
)

SF_OPS_ORG_ID = uuid.UUID("e1000001-0000-4000-8000-000000000003")
USER_ORG_ID = uuid.UUID("e1000001-0000-4000-8000-000000000001")
LARRY_ID = uuid.UUID("00000000-0000-0000-0000-000000000040")


def _scalar_result(value: object | None) -> MagicMock:
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    return result


@pytest.fixture
def mock_db() -> AsyncMock:
    return AsyncMock()


@pytest.mark.asyncio
async def test_resolve_uses_user_organization_id(mock_db: AsyncMock) -> None:
    user = User(
        id=LARRY_ID,
        email="larrysanders@example.dk",
        display_name="Larry",
        role="admin",
        is_active=True,
        organization_id=USER_ORG_ID,
    )
    org_id = await resolve_integration_organization_id(mock_db, user)
    assert org_id == USER_ORG_ID
    mock_db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_resolve_admin_without_org_uses_sf_operations(mock_db: AsyncMock) -> None:
    user = User(
        id=LARRY_ID,
        email="larrysanders@example.dk",
        display_name="Larry",
        role="admin",
        is_active=True,
        organization_id=None,
    )
    mock_db.execute = AsyncMock(return_value=_scalar_result(SF_OPS_ORG_ID))

    org_id = await resolve_integration_organization_id(mock_db, user)

    assert org_id == SF_OPS_ORG_ID
    mock_db.execute.assert_awaited()


@pytest.mark.asyncio
async def test_resolve_agent_without_org_raises(mock_db: AsyncMock) -> None:
    user = User(
        id=uuid.uuid4(),
        email="agent@example.dk",
        display_name="Agent",
        role=ROLE_AGENT,
        is_active=True,
        organization_id=None,
    )
    with pytest.raises(IntegrationOrganizationError):
        await resolve_integration_organization_id(mock_db, user)


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


async def _larry_admin() -> User:
    return User(
        id=LARRY_ID,
        email="larrysanders@example.dk",
        display_name="Larry",
        role="admin",
        is_active=True,
        organization_id=None,
    )


@pytest.mark.asyncio
async def test_slack_status_admin_without_user_org(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    app.dependency_overrides[get_current_user] = _larry_admin
    override_db.execute = AsyncMock(return_value=_scalar_result(SF_OPS_ORG_ID))
    try:
        with patch(
            "star_itsm_api.routers.slack.get_slack_integration",
            new_callable=AsyncMock,
            return_value=None,
        ):
            response = await api_client.get("/api/v1/integrations/slack/status")
        assert response.status_code == 200
        assert response.json()["connected"] is False
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_gmail_status_admin_without_user_org(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    app.dependency_overrides[get_current_user] = _larry_admin
    override_db.execute = AsyncMock(return_value=_scalar_result(SF_OPS_ORG_ID))
    try:
        with patch(
            "star_itsm_api.routers.gmail.get_email_integration",
            new_callable=AsyncMock,
            return_value=None,
        ):
            response = await api_client.get("/api/v1/integrations/gmail/status")
        assert response.status_code == 200
        assert response.json()["connected"] is False
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_integration_scope_admin_without_user_org(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    app.dependency_overrides[get_current_user] = _larry_admin

    override_db.execute = AsyncMock(
        side_effect=[
            _scalar_result(SF_OPS_ORG_ID),
            _scalar_result("SF Operations"),
        ],
    )
    try:
        response = await api_client.get("/api/v1/integrations/scope")
        assert response.status_code == 200
        body = response.json()
        assert body["organization_id"] == str(SF_OPS_ORG_ID)
        assert body["organization_name"] == "SF Operations"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_slack_oauth_start_missing_oauth_config_returns_503(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    app.dependency_overrides[get_current_user] = _larry_admin
    override_db.execute = AsyncMock(return_value=_scalar_result(SF_OPS_ORG_ID))
    try:
        response = await api_client.get("/api/v1/integrations/slack/oauth/start")
        assert response.status_code == 503
        detail = response.json()["detail"]
        assert "OAuth mangler konfiguration" in detail or "JWT_SECRET mangler" in detail
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_slack_oauth_start_admin_without_user_org(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    app.dependency_overrides[get_current_user] = _larry_admin
    override_db.execute = AsyncMock(return_value=_scalar_result(SF_OPS_ORG_ID))
    try:
        with (
            patch(
                "star_itsm_api.routers.slack.create_oauth_state",
                return_value="state-token",
            ),
            patch(
                "star_itsm_api.routers.slack.build_oauth_authorize_url",
                return_value="https://slack.com/oauth/authorize",
            ),
        ):
            response = await api_client.get("/api/v1/integrations/slack/oauth/start")
        assert response.status_code == 200
        assert "authorize_url" in response.json()
    finally:
        app.dependency_overrides.pop(get_current_user, None)
