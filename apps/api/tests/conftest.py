import os
import uuid
from collections.abc import AsyncIterator
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

# Set before star_itsm_api imports — test modules read PROTOTYPE_BOOTSTRAP_PASSWORD at collection.
_PYTEST_BOOTSTRAP = "Stardesk2026!"  # NOSONAR python:S2068 — CI/local pytest default only


def _ensure_prototype_bootstrap_password() -> None:
    if os.environ.get("PROTOTYPE_BOOTSTRAP_PASSWORD"):
        return
    env_file = Path(__file__).resolve().parents[1] / ".env"
    if env_file.is_file():
        for raw in env_file.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            if key.strip() != "PROTOTYPE_BOOTSTRAP_PASSWORD":
                continue
            cleaned = value.strip().strip('"').strip("'")
            if cleaned:
                os.environ["PROTOTYPE_BOOTSTRAP_PASSWORD"] = cleaned
                return
    os.environ.setdefault("PROTOTYPE_BOOTSTRAP_PASSWORD", _PYTEST_BOOTSTRAP)


_ensure_prototype_bootstrap_password()

import star_itsm_api.db as db_module  # noqa: E402
from star_itsm_api.core.security import get_current_user, get_current_user_session  # noqa: E402
from star_itsm_api.deps import require_db  # noqa: E402
from star_itsm_api.main import app  # noqa: E402

FAKE_ADMIN = SimpleNamespace(
    id=uuid.UUID("00000000-0000-0000-0000-000000000030"),
    email="admin@example.dk",
    display_name="Admin Bruger",
    role="admin",
    is_active=True,
    password_hash=None,
    deleted_at=None,
    must_change_password=False,
)


def _fake_admin_user() -> SimpleNamespace:
    return FAKE_ADMIN


def _fake_admin_session() -> SimpleNamespace:
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
    app.dependency_overrides[get_current_user_session] = _fake_admin_session
    yield
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_current_user_session, None)


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def mock_db() -> AsyncMock:
    session = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.flush = AsyncMock()
    return session


@pytest.fixture
def override_db(mock_db: AsyncMock) -> AsyncIterator[AsyncMock]:
    def _require_db() -> AsyncMock:
        return mock_db

    app.dependency_overrides[require_db] = _require_db
    yield mock_db
    app.dependency_overrides.pop(require_db, None)


@pytest.fixture
async def api_client(override_db: AsyncMock) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client


@pytest.fixture(autouse=True)
def _reset_active_teams_cache() -> None:
    """Reset the active teams cache in ticket_read service before and after every test."""
    try:
        from star_itsm_api.services.ticket_read import clear_active_teams_cache
        clear_active_teams_cache()
    except ImportError:
        pass
