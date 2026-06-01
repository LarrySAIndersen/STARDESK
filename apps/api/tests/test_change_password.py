import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from star_itsm_api.core.security import hash_password, verify_password
from star_itsm_api.main import app
from tests.change_password_payload import change_password_body
from tests.prototype_test_credentials import (
    KNOWN_PASSWORD,
    LARRY_PASSWORD,
    NEW_INVALID_PASSWORD,
    NEW_VALID_PASSWORD,
    WRONG_CURRENT_PASSWORD,
)

NEW_PASSWORD = NEW_VALID_PASSWORD
INVALID_NEW_PASSWORD = NEW_INVALID_PASSWORD
TEST_EMAIL = "sf01@example.dk"




@pytest.mark.asyncio
async def test_change_password_success(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    user = SimpleNamespace(
        id=uuid.uuid4(),
        email=TEST_EMAIL,
        password_hash=hash_password(KNOWN_PASSWORD),
        is_active=True,
        deleted_at=None,
        must_change_password=True,
    )

    with patch(
        "star_itsm_api.routers.auth.get_user_by_email",
        new_callable=AsyncMock,
        return_value=user,
    ):
        response = await api_client.post(
            "/api/v1/auth/change-password",
            json=change_password_body(TEST_EMAIL, KNOWN_PASSWORD, NEW_PASSWORD),
        )

    assert response.status_code == 204
    assert verify_password(NEW_PASSWORD, user.password_hash)
    assert user.must_change_password is False
    override_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_change_password_with_prototype_bootstrap(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    """Users with a custom hash can still reset via shared prototype password."""
    user = SimpleNamespace(
        id=uuid.uuid4(),
        email=TEST_EMAIL,
        password_hash=hash_password(LARRY_PASSWORD),
        is_active=True,
        deleted_at=None,
        must_change_password=True,
    )

    with patch(
        "star_itsm_api.routers.auth.get_user_by_email",
        new_callable=AsyncMock,
        return_value=user,
    ):
        response = await api_client.post(
            "/api/v1/auth/change-password",
            json=change_password_body(TEST_EMAIL, KNOWN_PASSWORD, NEW_PASSWORD),
        )

    assert response.status_code == 204
    assert verify_password(NEW_PASSWORD, user.password_hash)
    override_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_change_password_wrong_current(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    user = SimpleNamespace(
        id=uuid.uuid4(),
        email=TEST_EMAIL,
        password_hash=hash_password(KNOWN_PASSWORD),
        is_active=True,
        deleted_at=None,
    )

    with patch(
        "star_itsm_api.routers.auth.get_user_by_email",
        new_callable=AsyncMock,
        return_value=user,
    ):
        response = await api_client.post(
            "/api/v1/auth/change-password",
            json=change_password_body(TEST_EMAIL, WRONG_CURRENT_PASSWORD, NEW_PASSWORD),
        )

    assert response.status_code == 401
    assert response.json()["detail"] == "Forkert e-mail eller nuværende adgangskode"
    assert verify_password(KNOWN_PASSWORD, user.password_hash)
    override_db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_change_password_rejects_invalid_new_password(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    user = SimpleNamespace(
        id=uuid.uuid4(),
        email=TEST_EMAIL,
        password_hash=hash_password(KNOWN_PASSWORD),
        is_active=True,
        deleted_at=None,
        must_change_password=True,
    )

    with patch(
        "star_itsm_api.routers.auth.get_user_by_email",
        new_callable=AsyncMock,
        return_value=user,
    ):
        response = await api_client.post(
            "/api/v1/auth/change-password",
            json=change_password_body(TEST_EMAIL, KNOWN_PASSWORD, INVALID_NEW_PASSWORD),
        )

    assert response.status_code == 422
    assert "bogstaver og tal" in response.json()["detail"]
    assert user.must_change_password is True
    override_db.commit.assert_not_awaited()
