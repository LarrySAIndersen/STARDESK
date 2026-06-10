"""FINDING-114 — supporter must not read admin config or user list."""

import uuid
from types import SimpleNamespace

import pytest
from httpx import AsyncClient

from star_itsm_api.core.security import ROLE_SUPPORTER, get_current_user
from star_itsm_api.main import app


def _fake_supporter() -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        email="larrysanders2@example.dk",
        display_name="Larrysanders2",
        role=ROLE_SUPPORTER,
        is_active=True,
        password_hash=None,
        deleted_at=None,
        organization_id=None,
        must_change_password=False,
    )


@pytest.mark.asyncio
async def test_supporter_cannot_list_users(api_client: AsyncClient) -> None:
    app.dependency_overrides[get_current_user] = _fake_supporter
    try:
        response = await api_client.get("/api/v1/users")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_supporter_cannot_read_admin_sla_settings(api_client: AsyncClient) -> None:
    app.dependency_overrides[get_current_user] = _fake_supporter
    try:
        response = await api_client.get("/api/v1/admin/sla/settings")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_supporter_cannot_read_admin_categories(api_client: AsyncClient) -> None:
    app.dependency_overrides[get_current_user] = _fake_supporter
    try:
        response = await api_client.get("/api/v1/admin/categories")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)
