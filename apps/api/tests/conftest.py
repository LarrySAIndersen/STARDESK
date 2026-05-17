from collections.abc import AsyncIterator
from types import SimpleNamespace
import uuid

import pytest
from httpx import ASGITransport, AsyncClient

import star_itsm_api.db as db_module
from star_itsm_api.core.security import get_current_user
from star_itsm_api.main import app

FAKE_ADMIN = SimpleNamespace(
    id=uuid.UUID("00000000-0000-0000-0000-000000000030"),
    email="admin@example.dk",
    display_name="Admin Bruger",
    role="admin",
    is_active=True,
    password_hash=None,
    deleted_at=None,
)


async def _fake_admin_user() -> SimpleNamespace:
    return FAKE_ADMIN


@pytest.fixture(autouse=True)
def _disable_database_for_unit_tests(monkeypatch: pytest.MonkeyPatch) -> None:
    """Unit tests must not hit production Neon."""
    monkeypatch.setattr(db_module.settings, "database_url", None)
    monkeypatch.setattr(db_module, "engine", None)
    monkeypatch.setattr(db_module, "async_session_factory", None)


@pytest.fixture(autouse=True)
def _authenticated_requests() -> AsyncIterator[None]:
    app.dependency_overrides[get_current_user] = _fake_admin_user
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
