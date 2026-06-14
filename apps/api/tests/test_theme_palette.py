"""Theme palette preference API tests."""

import uuid
from collections.abc import AsyncIterator
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from star_itsm_api.core.security import get_current_user_session
from star_itsm_api.main import app
from star_itsm_api.schemas.theme_palette import (
    VALID_PRESET_IDS,
    ThemePalettePreference,
    ThemePaletteSlotOverrides,
    ThemePaletteUpdateRequest,
)
from star_itsm_api.services import org_access
from star_itsm_api.services.theme_palette import merge_theme_palette_update, validate_theme_palette


@pytest.fixture(autouse=True)
def _use_mock_db(override_db: AsyncMock) -> None:
    pass


@pytest.fixture
async def unauthenticated_client(override_db: AsyncMock) -> AsyncIterator[AsyncClient]:
    app.dependency_overrides.pop(get_current_user_session, None)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


def _staff_user() -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        email="sf01@example.dk",
        display_name="Anna Agent",
        role="admin",
        is_active=True,
        password_hash=None,
        deleted_at=None,
        must_change_password=False,
        password_policy_exempt=False,
        organization_id=None,
        avatar_url=None,
        avatar_preset_id=None,
        ui_mode=None,
        theme_palette=None,
    )


@pytest.fixture
async def palette_client(override_db: AsyncMock, monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[AsyncClient]:
    user = _staff_user()

    def _as_user() -> SimpleNamespace:
        return user

    app.dependency_overrides[get_current_user_session] = _as_user
    monkeypatch.setattr(org_access, "get_user_organization_id", lambda _user: None)
    monkeypatch.setattr(
        "star_itsm_api.routers.auth._organization_name",
        AsyncMock(return_value=None),
    )
    monkeypatch.setattr(
        "star_itsm_api.routers.auth.ensure_user_roles_loaded",
        AsyncMock(return_value=["admin"]),
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


def test_validate_theme_palette_accepts_star_standard() -> None:
    preference = ThemePalettePreference(preset_id="star-standard")
    validate_theme_palette(preference)


@pytest.mark.parametrize("preset_id", sorted(VALID_PRESET_IDS))
def test_all_presets_pass_contrast_validation(preset_id: str) -> None:
    validate_theme_palette(ThemePalettePreference(preset_id=preset_id))


def test_validate_theme_palette_rejects_low_contrast_override() -> None:
    preference = ThemePalettePreference(
        preset_id="star-standard",
        overrides={
            "light": ThemePaletteSlotOverrides(
                background="#ffffff",
                surface="#ffffff",
                primary="#f5f5f5",
            ),
        },
    )
    with pytest.raises(ValueError, match="kontrast"):
        validate_theme_palette(preference)


def test_merge_theme_palette_update_keeps_existing_overrides() -> None:
    current = ThemePalettePreference(
        preset_id="ocean",
        overrides={"dark": ThemePaletteSlotOverrides(primary="#4db8d9")},
    )
    merged = merge_theme_palette_update(
        current,
        ThemePaletteUpdateRequest(preset_id="forest"),
    )
    assert merged.preset_id == "forest"
    assert merged.overrides is not None
    assert merged.overrides["dark"].primary == "#4db8d9"


@pytest.mark.asyncio
async def test_patch_theme_palette_requires_auth(unauthenticated_client: AsyncClient) -> None:
    response = await unauthenticated_client.patch(
        "/api/v1/auth/me/theme-palette",
        json={"preset_id": "ocean"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_patch_theme_palette_persists_for_user(palette_client: AsyncClient) -> None:
    response = await palette_client.patch(
        "/api/v1/auth/me/theme-palette",
        json={"preset_id": "forest"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["theme_palette"]["preset_id"] == "forest"


@pytest.mark.asyncio
async def test_patch_theme_palette_blocks_invalid_preset(palette_client: AsyncClient) -> None:
    response = await palette_client.patch(
        "/api/v1/auth/me/theme-palette",
        json={"preset_id": "not-a-real-preset"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_patch_theme_palette_blocks_low_contrast(palette_client: AsyncClient) -> None:
    response = await palette_client.patch(
        "/api/v1/auth/me/theme-palette",
        json={
            "preset_id": "star-standard",
            "overrides": {
                "light": {
                    "background": "#ffffff",
                    "surface": "#ffffff",
                    "primary": "#f8f8f8",
                },
            },
        },
    )
    assert response.status_code == 422
    assert "kontrast" in response.json()["detail"].lower()
