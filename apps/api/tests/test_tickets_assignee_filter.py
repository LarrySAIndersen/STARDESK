import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from star_itsm_api.core.security import ROLE_AGENT, ROLE_TOP_ADMIN, get_current_user
from star_itsm_api.main import app

ASSIGNEE_ID = uuid.UUID("00000000-0000-0000-0000-000000000099")




def _fake_top_admin() -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        email="admin@example.dk",
        display_name="Admin",
        role=ROLE_TOP_ADMIN,
        is_active=True,
        password_hash=None,
        deleted_at=None,
        organization_id=None,
    )


def _fake_agent() -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        email="agent@example.dk",
        display_name="Agent",
        role=ROLE_AGENT,
        is_active=True,
        password_hash=None,
        deleted_at=None,
        organization_id=None,
    )


@pytest.mark.asyncio
async def test_list_tickets_assignee_filter_forbidden_for_agent(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    app.dependency_overrides[get_current_user] = _fake_agent
    try:
        response = await api_client.get(
            f"/api/v1/tickets?assignee_id={ASSIGNEE_ID}",
        )
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_list_tickets_assignee_filter_success(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    app.dependency_overrides[get_current_user] = _fake_top_admin
    mock_scalars = SimpleNamespace(all=lambda: [])
    mock_result = SimpleNamespace(scalars=lambda: mock_scalars)
    override_db.execute = AsyncMock(return_value=mock_result)

    with patch(
        "star_itsm_api.routers.tickets.tickets_to_read_list",
        new_callable=AsyncMock,
        return_value=[],
    ):
        try:
            response = await api_client.get(
                f"/api/v1/tickets?assignee_id={ASSIGNEE_ID}",
            )
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    assert response.json() == []
