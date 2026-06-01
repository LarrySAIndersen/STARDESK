import uuid
from collections.abc import AsyncIterator
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from star_itsm_api.core.config import settings
from star_itsm_api.core.demo import PROTOTYPE_BOOTSTRAP_PASSWORD
from star_itsm_api.core.prototype_credentials import LARRY_PROTOTYPE_PASSWORD
from star_itsm_api.core.security import verify_password
from star_itsm_api.deps import require_db
from star_itsm_api.main import app
from star_itsm_api.models.user import User
from star_itsm_api.routers import auth as auth_router

LARRY_EMAIL = "larrysanders@example.dk"
LARRY_ID = uuid.UUID("00000000-0000-0000-0000-000000000040")
SF01_EMAIL = "sf01@example.dk"
SF01_ID = uuid.UUID("00000000-0000-0000-0000-000000000050")
WRONG_HASH = "$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC"


@pytest.fixture
async def repair_login_client(
    monkeypatch: pytest.MonkeyPatch,
) -> AsyncIterator[AsyncClient]:
    users: dict[str, User] = {
        LARRY_EMAIL: User(
            id=LARRY_ID,
            email=LARRY_EMAIL,
            display_name="Larrysanders",
            role="admin",
            is_active=True,
            password_hash=WRONG_HASH,
            organization_id=None,
            deleted_at=None,
        ),
        SF01_EMAIL: User(
            id=SF01_ID,
            email=SF01_EMAIL,
            display_name="Anna",
            role="top_admin",
            is_active=True,
            password_hash=WRONG_HASH,
            organization_id=None,
            deleted_at=None,
        ),
    }

    monkeypatch.setattr(
        settings,
        "jwt_secret",
        "test-jwt-secret-for-login-tests-only-32",
    )

    def _fake_get_user_by_email(_db: object, email: str) -> User | None:
        return users.get(email)

    def _fake_db() -> AsyncMock:
        return AsyncMock()

    monkeypatch.setattr(
        auth_router,
        "get_user_by_email",
        AsyncMock(side_effect=_fake_get_user_by_email),
    )
    monkeypatch.setattr(
        auth_router,
        "enforce_sole_top_admin_on_login",
        AsyncMock(return_value=None),
    )
    monkeypatch.setattr(
        auth_router,
        "ensure_prototype_staff_account",
        AsyncMock(return_value=None),
    )
    app.dependency_overrides[require_db] = _fake_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.pop(require_db, None)


@pytest.mark.asyncio
async def test_login_repairs_larry_password_hash(repair_login_client: AsyncClient) -> None:
    response = await repair_login_client.post(
        "/api/v1/auth/login",
        json={"email": LARRY_EMAIL, "password": LARRY_PROTOTYPE_PASSWORD},
    )
    assert response.status_code == 200
    user = await auth_router.get_user_by_email(None, LARRY_EMAIL)
    assert user is not None
    assert verify_password(LARRY_PROTOTYPE_PASSWORD, user.password_hash)


@pytest.mark.asyncio
async def test_login_repairs_demo_user_with_bootstrap_password(
    repair_login_client: AsyncClient,
) -> None:
    response = await repair_login_client.post(
        "/api/v1/auth/login",
        json={"email": SF01_EMAIL, "password": PROTOTYPE_BOOTSTRAP_PASSWORD},
    )
    assert response.status_code == 200
    user = await auth_router.get_user_by_email(None, SF01_EMAIL)
    assert user is not None
    assert verify_password(PROTOTYPE_BOOTSTRAP_PASSWORD, user.password_hash)
