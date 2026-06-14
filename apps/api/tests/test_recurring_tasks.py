from collections.abc import AsyncIterator
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from star_itsm_api.core.security import get_current_user, get_current_user_session
from star_itsm_api.main import app
from star_itsm_api.services.recurring_tasks import add_schedule_interval, schedule_label_da


def test_add_schedule_interval_hour() -> None:
    start = datetime(2026, 6, 14, 10, 0, tzinfo=UTC)
    result = add_schedule_interval(start, unit="hour", interval=2)
    assert result == datetime(2026, 6, 14, 12, 0, tzinfo=UTC)


def test_add_schedule_interval_day() -> None:
    start = datetime(2026, 6, 14, 10, 0, tzinfo=UTC)
    result = add_schedule_interval(start, unit="day", interval=1)
    assert result == datetime(2026, 6, 15, 10, 0, tzinfo=UTC)


def test_add_schedule_interval_month_end_of_month() -> None:
    start = datetime(2026, 1, 31, 8, 0, tzinfo=UTC)
    result = add_schedule_interval(start, unit="month", interval=1)
    assert result == datetime(2026, 2, 28, 8, 0, tzinfo=UTC)


def test_schedule_label_da_singular_and_plural() -> None:
    assert schedule_label_da("day", 1) == "Hver dag"
    assert schedule_label_da("hour", 3) == "Hver 3. timer"
    assert schedule_label_da("week", 2) == "Hver 2. uger"


@pytest.fixture
async def unauthenticated_client(override_db: AsyncMock) -> AsyncIterator[AsyncClient]:
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_current_user_session, None)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client


@pytest.mark.asyncio
async def test_recurring_tasks_requires_auth(unauthenticated_client: AsyncClient) -> None:
    response = await unauthenticated_client.get("/api/v1/recurring-tasks")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_recurring_tasks_cron_requires_secret(
    api_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from star_itsm_api.core.config import settings

    monkeypatch.setattr(settings, "cron_secret", "test-cron-secret-value-12345")
    response = await api_client.post("/api/v1/cron/recurring-tasks")
    assert response.status_code == 401
