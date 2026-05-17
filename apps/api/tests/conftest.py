from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

import star_itsm_api.db as db_module
from star_itsm_api.main import app


@pytest.fixture(autouse=True)
def _disable_database_for_unit_tests(monkeypatch: pytest.MonkeyPatch) -> None:
    """Unit tests must not hit production Neon."""
    monkeypatch.setattr(db_module.settings, "database_url", None)
    monkeypatch.setattr(db_module, "engine", None)
    monkeypatch.setattr(db_module, "async_session_factory", None)


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
