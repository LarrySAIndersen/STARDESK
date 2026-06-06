"""Batch 15 — Gmail integration router endpoint coverage."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from star_itsm_api.core.config import settings
from star_itsm_api.core.security import get_current_user
from star_itsm_api.main import app
from star_itsm_api.models.email_integration import EmailIntegration
from star_itsm_api.models.user import User
from star_itsm_api.services.gmail import GmailApiError, GmailSyncStats

SF_OPS_ORG_ID = uuid.UUID("e1000001-0000-4000-8000-000000000003")
LARRY_ID = uuid.UUID("00000000-0000-0000-0000-000000000040")


def _rows_result(rows: list[tuple[object, ...]]) -> MagicMock:
    result = MagicMock()
    result.all.return_value = rows
    return result


def _larry_admin() -> User:
    return User(
        id=LARRY_ID,
        email="larrysanders@example.dk",
        display_name="Larry",
        role="admin",
        is_active=True,
        organization_id=None,
    )


@pytest.mark.asyncio
async def test_gmail_oauth_start_success(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    app.dependency_overrides[get_current_user] = _larry_admin
    override_db.execute = AsyncMock(
        return_value=_rows_result([(SF_OPS_ORG_ID, "SF Operations")]),
    )
    try:
        with (
            patch(
                "star_itsm_api.routers.gmail.create_oauth_state",
                return_value="state-token",
            ),
            patch(
                "star_itsm_api.routers.gmail.build_oauth_authorize_url",
                return_value="https://accounts.google.com/o/oauth2/v2/auth",
            ),
        ):
            response = await api_client.get("/api/v1/integrations/gmail/oauth/start")
        assert response.status_code == 200
        assert "authorize_url" in response.json()
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_gmail_oauth_callback_missing_code(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/v1/integrations/gmail/oauth/callback")
    assert response.status_code == 400
    assert "Mangler Gmail OAuth" in response.json()["detail"]


@pytest.mark.asyncio
async def test_gmail_oauth_callback_error_param(api_client: AsyncClient) -> None:
    response = await api_client.get(
        "/api/v1/integrations/gmail/oauth/callback",
        params={"error": "access_denied"},
    )
    assert response.status_code == 400
    assert "Gmail OAuth fejl" in response.json()["detail"]


@pytest.mark.asyncio
async def test_gmail_oauth_callback_success(api_client: AsyncClient) -> None:
    org_id = SF_OPS_ORG_ID
    with (
        patch(
            "star_itsm_api.routers.gmail.parse_oauth_state",
            return_value=(org_id, LARRY_ID),
        ),
        patch(
            "star_itsm_api.routers.gmail.get_email_integration",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch(
            "star_itsm_api.routers.gmail.exchange_oauth_code",
            new_callable=AsyncMock,
            return_value=("access", "refresh"),
        ),
        patch(
            "star_itsm_api.routers.gmail.fetch_profile_email",
            new_callable=AsyncMock,
            return_value="desk@example.dk",
        ),
        patch(
            "star_itsm_api.routers.gmail.upsert_email_integration",
            new_callable=AsyncMock,
        ),
    ):
        response = await api_client.get(
            "/api/v1/integrations/gmail/oauth/callback",
            params={"code": "oauth-code", "state": "state-token"},
        )
    assert response.status_code == 200
    body = response.json()
    assert body["connected"] is True
    assert body["connected_email"] == "desk@example.dk"


@pytest.mark.asyncio
async def test_gmail_status_connected(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    app.dependency_overrides[get_current_user] = _larry_admin
    override_db.execute = AsyncMock(
        return_value=_rows_result([(SF_OPS_ORG_ID, "SF Operations")]),
    )
    integration = EmailIntegration(
        organization_id=SF_OPS_ORG_ID,
        provider="gmail",
        refresh_token_encrypted="enc:token",
        connected_email="desk@example.dk",
        enabled=True,
    )
    try:
        with patch(
            "star_itsm_api.routers.gmail.get_email_integration",
            new_callable=AsyncMock,
            return_value=integration,
        ):
            response = await api_client.get("/api/v1/integrations/gmail/status")
        assert response.status_code == 200
        body = response.json()
        assert body["connected"] is True
        assert body["connected_email"] == "desk@example.dk"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_gmail_settings_update(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    app.dependency_overrides[get_current_user] = _larry_admin
    override_db.execute = AsyncMock(
        return_value=_rows_result([(SF_OPS_ORG_ID, "SF Operations")]),
    )
    integration = EmailIntegration(
        organization_id=SF_OPS_ORG_ID,
        provider="gmail",
        refresh_token_encrypted="enc:token",
        connected_email="desk@example.dk",
        enabled=False,
    )
    try:
        with patch(
            "star_itsm_api.routers.gmail.save_gmail_preferences",
            new_callable=AsyncMock,
            return_value=integration,
        ):
            response = await api_client.patch(
                "/api/v1/integrations/gmail/settings",
                json={"enabled": False},
            )
        assert response.status_code == 200
        assert response.json()["enabled"] is False
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_gmail_sync_success(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    app.dependency_overrides[get_current_user] = _larry_admin
    override_db.execute = AsyncMock(
        return_value=_rows_result([(SF_OPS_ORG_ID, "SF Operations")]),
    )
    try:
        with patch(
            "star_itsm_api.routers.gmail.sync_gmail_inbox",
            new_callable=AsyncMock,
            return_value=GmailSyncStats(processed=3, created_tickets=1),
        ):
            response = await api_client.post("/api/v1/integrations/gmail/sync")
        assert response.status_code == 200
        body = response.json()
        assert body["processed"] == 3
        assert body["created_tickets"] == 1
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_gmail_sync_gmail_error(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    app.dependency_overrides[get_current_user] = _larry_admin
    override_db.execute = AsyncMock(
        return_value=_rows_result([(SF_OPS_ORG_ID, "SF Operations")]),
    )
    try:
        with patch(
            "star_itsm_api.routers.gmail.sync_gmail_inbox",
            new_callable=AsyncMock,
            side_effect=GmailApiError("Sync fejlede"),
        ):
            response = await api_client.post("/api/v1/integrations/gmail/sync")
        assert response.status_code == 400
        assert "Sync fejlede" in response.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_gmail_test_connection_mock(
    override_db: AsyncMock,
    api_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app.dependency_overrides[get_current_user] = _larry_admin
    monkeypatch.setattr(settings, "gmail_mock", True)
    override_db.execute = AsyncMock(
        return_value=_rows_result([(SF_OPS_ORG_ID, "SF Operations")]),
    )
    try:
        with patch(
            "star_itsm_api.routers.gmail.get_email_integration",
            new_callable=AsyncMock,
            return_value=None,
        ):
            response = await api_client.get("/api/v1/integrations/gmail/test")
        assert response.status_code == 200
        assert response.json()["ok"] is True
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_gmail_test_connection_not_connected(
    override_db: AsyncMock,
    api_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app.dependency_overrides[get_current_user] = _larry_admin
    monkeypatch.setattr(settings, "gmail_mock", False)
    override_db.execute = AsyncMock(
        return_value=_rows_result([(SF_OPS_ORG_ID, "SF Operations")]),
    )
    try:
        with patch(
            "star_itsm_api.routers.gmail.get_email_integration",
            new_callable=AsyncMock,
            return_value=None,
        ):
            response = await api_client.get("/api/v1/integrations/gmail/test")
        assert response.status_code == 400
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_gmail_disconnect(
    override_db: AsyncMock,
    api_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app.dependency_overrides[get_current_user] = _larry_admin
    monkeypatch.setattr(settings, "gmail_mock", True)
    override_db.execute = AsyncMock(
        return_value=_rows_result([(SF_OPS_ORG_ID, "SF Operations")]),
    )
    try:
        with patch(
            "star_itsm_api.routers.gmail.disconnect_gmail",
            new_callable=AsyncMock,
        ):
            response = await api_client.post("/api/v1/integrations/gmail/disconnect")
        assert response.status_code == 200
        assert response.json()["connected"] is False
    finally:
        app.dependency_overrides.pop(get_current_user, None)
