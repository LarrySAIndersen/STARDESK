from types import SimpleNamespace

import pytest
from httpx import AsyncClient

from star_itsm_api.core.security import ROLE_SUBMITTER, get_current_user
from star_itsm_api.main import app


async def _fake_end_user() -> SimpleNamespace:
    return SimpleNamespace(
        id="00000000-0000-0000-0000-000000000099",
        email="submitter@example.dk",
        display_name="Submitter",
        role=ROLE_SUBMITTER,
        is_active=True,
        password_hash=None,
        deleted_at=None,
        organization_id=None,
    )


@pytest.mark.asyncio
async def test_tickets_export_forbidden_for_end_user(client: AsyncClient) -> None:
    app.dependency_overrides[get_current_user] = _fake_end_user
    try:
        response = await client.get("/api/v1/reports/tickets/export")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_tickets_export_without_database_returns_503(client: AsyncClient) -> None:
    response = await client.get("/api/v1/reports/tickets/export")
    assert response.status_code == 503
