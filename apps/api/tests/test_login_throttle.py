"""Login rate limiting and account lockout (FINDING-101)."""

import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from star_itsm_api.core.config import settings
from star_itsm_api.core.demo import PROTOTYPE_BOOTSTRAP_PASSWORD
from star_itsm_api.core.security import verify_password
from star_itsm_api.deps import require_db
from star_itsm_api.main import app
from star_itsm_api.models.login_throttle import SCOPE_ACCOUNT, SCOPE_IP, LoginThrottle
from star_itsm_api.models.user import User
from star_itsm_api.routers import auth as auth_router
from star_itsm_api.services import login_throttle as throttle_service

LARRY_EMAIL = "larrysanders@example.dk"
LARRY_ID = uuid.UUID("00000000-0000-0000-0000-000000000040")


@pytest.fixture(autouse=True)
def _low_lockout_thresholds(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "login_account_max_failures", 3)
    monkeypatch.setattr(settings, "login_ip_max_attempts", 100)
    monkeypatch.setattr(settings, "login_lockout_minutes", 15)


@pytest.fixture
def throttle_store() -> dict[tuple[str, str], LoginThrottle]:
    return {}


@pytest.fixture
def patch_throttle_db(
    monkeypatch: pytest.MonkeyPatch,
    throttle_store: dict[tuple[str, str], LoginThrottle],
) -> None:
    async def fake_get_row(
        _db: object,
        *,
        scope: str,
        throttle_key: str,
    ) -> LoginThrottle | None:
        return throttle_store.get((scope, throttle_key))

    async def fake_upsert_row(_db: object, row: LoginThrottle) -> None:
        throttle_store[(row.scope, row.throttle_key)] = row

    monkeypatch.setattr(throttle_service, "_get_row", fake_get_row)
    monkeypatch.setattr(throttle_service, "_upsert_row", fake_upsert_row)


@pytest.fixture
async def throttle_login_client(
    monkeypatch: pytest.MonkeyPatch,
    patch_throttle_db: None,
) -> AsyncIterator[AsyncClient]:
    user = User(
        id=LARRY_ID,
        email=LARRY_EMAIL,
        display_name="Larrysanders",
        role="admin",
        is_active=True,
        password_hash="old-hash",
        organization_id=None,
        deleted_at=None,
        must_change_password=False,
        password_policy_exempt=True,
    )

    monkeypatch.setattr(
        settings,
        "jwt_secret",
        "test-jwt-secret-for-login-tests-only-32",
    )

    async def _fake_get_user_by_email(_db: object, email: str) -> User | None:
        if email == LARRY_EMAIL:
            return user
        return None

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
    monkeypatch.setattr(
        auth_router,
        "_login_password_valid",
        lambda _user, password: password == PROTOTYPE_BOOTSTRAP_PASSWORD,
    )

    app.dependency_overrides[require_db] = lambda: AsyncMock()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.pop(require_db, None)


@pytest.mark.asyncio
async def test_account_lockout_after_repeated_failures(
    throttle_login_client: AsyncClient,
    throttle_store: dict[tuple[str, str], LoginThrottle],
) -> None:
    for _ in range(3):
        response = await throttle_login_client.post(
            "/api/v1/auth/login",
            json={"email": LARRY_EMAIL, "password": "wrong-password"},
            headers={"X-Forwarded-For": "203.0.113.10"},
        )
        assert response.status_code == 401

    locked = await throttle_login_client.post(
        "/api/v1/auth/login",
        json={"email": LARRY_EMAIL, "password": PROTOTYPE_BOOTSTRAP_PASSWORD},
        headers={"X-Forwarded-For": "203.0.113.10"},
    )
    assert locked.status_code == 429
    assert "Stardesk2026!" in locked.json()["detail"]

    account_row = throttle_store[(SCOPE_ACCOUNT, LARRY_EMAIL)]
    assert account_row.locked_until is not None


@pytest.mark.asyncio
async def test_lockout_resets_prototype_password_hash(
    monkeypatch: pytest.MonkeyPatch,
    patch_throttle_db: None,
) -> None:
    user = User(
        id=LARRY_ID,
        email=LARRY_EMAIL,
        display_name="Larrysanders",
        role="admin",
        is_active=True,
        password_hash="old-hash",
        organization_id=None,
        deleted_at=None,
    )
    db = AsyncMock()

    for _ in range(settings.login_account_max_failures):
        await throttle_service.on_login_failure(
            db,
            LARRY_EMAIL,
            "203.0.113.20",
            user,
        )

    assert user.password_hash != "old-hash"
    assert verify_password(PROTOTYPE_BOOTSTRAP_PASSWORD, user.password_hash)


@pytest.mark.asyncio
async def test_ip_rate_limit_returns_429(
    monkeypatch: pytest.MonkeyPatch,
    patch_throttle_db: None,
    throttle_store: dict[tuple[str, str], LoginThrottle],
) -> None:
    monkeypatch.setattr(settings, "login_ip_max_attempts", 2)
    now = datetime.now(UTC)
    throttle_store[(SCOPE_IP, "203.0.113.99")] = LoginThrottle(
        id=uuid.uuid4(),
        scope=SCOPE_IP,
        throttle_key="203.0.113.99",
        failed_attempts=2,
        window_started_at=now,
    )
    db = AsyncMock()

    with pytest.raises(HTTPException) as exc:
        await throttle_service.assert_login_allowed(db, "any@example.dk", "203.0.113.99")

    assert exc.value.status_code == 429
    assert "forbindelse" in exc.value.detail.lower()


@pytest.mark.asyncio
async def test_success_clears_account_throttle(
    patch_throttle_db: None,
    throttle_store: dict[tuple[str, str], LoginThrottle],
) -> None:
    throttle_store[(SCOPE_ACCOUNT, LARRY_EMAIL)] = LoginThrottle(
        id=uuid.uuid4(),
        scope=SCOPE_ACCOUNT,
        throttle_key=LARRY_EMAIL,
        failed_attempts=2,
        window_started_at=datetime.now(UTC),
    )
    db = AsyncMock()
    db.execute = AsyncMock(return_value=AsyncMock())
    db.commit = AsyncMock()

    await throttle_service.on_login_success(db, LARRY_EMAIL)

    db.execute.assert_awaited_once()
    db.commit.assert_awaited_once()
