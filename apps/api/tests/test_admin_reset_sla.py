import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from star_itsm_api.core.security import ROLE_AGENT, get_current_user
from star_itsm_api.main import app
from star_itsm_api.services.sla_reset import SlaResetResult

ADMIN_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


def _fake_admin() -> SimpleNamespace:
    return SimpleNamespace(
        id=ADMIN_ID,
        email="admin@example.dk",
        display_name="Admin",
        role="admin",
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
async def test_reset_sla_forbidden_for_agent(
    api_client: AsyncClient,
) -> None:
    app.dependency_overrides[get_current_user] = _fake_agent
    try:
        response = await api_client.post("/api/v1/admin/reset-sla")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_reset_sla_dry_run(
    api_client: AsyncClient,
) -> None:
    app.dependency_overrides[get_current_user] = _fake_admin
    with patch(
        "star_itsm_api.routers.admin.reset_all_ticket_sla",
        new_callable=AsyncMock,
        return_value=SlaResetResult(
            ticket_count=42,
            updated_count=0,
            dry_run=True,
            anchor="created_at",
        ),
    ) as reset_mock:
        try:
            response = await api_client.post(
                "/api/v1/admin/reset-sla",
                params={"dry_run": "true"},
            )
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    body = response.json()
    assert body["ticket_count"] == 42
    assert body["updated_count"] == 0
    assert body["dry_run"] is True
    assert body["anchor"] == "created_at"
    reset_mock.assert_awaited_once()
    assert reset_mock.await_args.kwargs["dry_run"] is True
    assert reset_mock.await_args.kwargs["anchor"] == "created_at"


@pytest.mark.asyncio
async def test_reset_sla_commits_updates(
    api_client: AsyncClient,
) -> None:
    app.dependency_overrides[get_current_user] = _fake_admin
    with patch(
        "star_itsm_api.routers.admin.reset_all_ticket_sla",
        new_callable=AsyncMock,
        return_value=SlaResetResult(
            ticket_count=3,
            updated_count=3,
            dry_run=False,
            anchor="now",
        ),
    ) as reset_mock:
        try:
            response = await api_client.post(
                "/api/v1/admin/reset-sla",
                params={"anchor": "now"},
            )
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    body = response.json()
    assert body["updated_count"] == 3
    assert body["anchor"] == "now"
    reset_mock.assert_awaited_once()
    assert reset_mock.await_args.kwargs == {"anchor": "now", "dry_run": False}


@pytest.mark.asyncio
async def test_reset_all_ticket_sla_dry_run_skips_commit(
    mock_db: AsyncMock,
) -> None:
    from star_itsm_api.services.sla_reset import reset_all_ticket_sla

    result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))
    mock_db.execute = AsyncMock(return_value=result)

    result = await reset_all_ticket_sla(mock_db, dry_run=True)

    assert result.ticket_count == 0
    assert result.dry_run is True
    mock_db.commit.assert_not_called()


@pytest.mark.asyncio
async def test_reset_all_ticket_sla_applies_policy(
    mock_db: AsyncMock,
) -> None:
    from star_itsm_api.services.sla_reset import reset_all_ticket_sla

    created = datetime(2026, 1, 1, 10, 0, tzinfo=UTC)
    ticket = SimpleNamespace(
        id=uuid.uuid4(),
        priority="high",
        category_id=None,
        subcategory_id=None,
        created_at=created,
        sla_policy_id=None,
        response_due_at=None,
        resolution_due_at=None,
        escalation_level=2,
        last_escalation_at=created,
        updated_at=None,
        deleted_at=None,
    )
    result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [ticket]))
    mock_db.execute = AsyncMock(return_value=result)

    with patch(
        "star_itsm_api.services.sla_reset.apply_sla_to_ticket",
        new_callable=AsyncMock,
    ) as apply_mock:
        result = await reset_all_ticket_sla(mock_db, anchor="created_at", dry_run=False)

    assert result.ticket_count == 1
    assert result.updated_count == 1
    assert ticket.escalation_level == 0
    assert ticket.last_escalation_at is None
    apply_mock.assert_awaited_once()
    assert apply_mock.await_args.kwargs["start_at"] == created
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_count_active_tickets(mock_db: AsyncMock) -> None:
    from unittest.mock import MagicMock

    from star_itsm_api.services.sla_reset import count_active_tickets
    mock_result = MagicMock()
    mock_result.scalar_one.return_value = 5
    mock_db.execute = AsyncMock(return_value=mock_result)

    count = await count_active_tickets(mock_db)
    assert count == 5


@pytest.mark.asyncio
async def test_reset_all_ticket_sla_anchor_now(mock_db: AsyncMock) -> None:
    from star_itsm_api.services.sla_reset import reset_all_ticket_sla

    created = datetime(2026, 1, 1, 10, 0, tzinfo=UTC)
    ticket = SimpleNamespace(
        id=uuid.uuid4(),
        priority="high",
        category_id=None,
        subcategory_id=None,
        created_at=created,
        sla_policy_id=None,
        response_due_at=None,
        resolution_due_at=None,
        escalation_level=2,
        last_escalation_at=created,
        updated_at=None,
        deleted_at=None,
    )
    result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [ticket]))
    mock_db.execute = AsyncMock(return_value=result)

    with patch(
        "star_itsm_api.services.sla_reset.apply_sla_to_ticket",
        new_callable=AsyncMock,
    ) as apply_mock:
        result = await reset_all_ticket_sla(mock_db, anchor="now", dry_run=False)

    assert result.ticket_count == 1
    assert result.updated_count == 1
    apply_mock.assert_awaited_once()
    assert abs((apply_mock.await_args.kwargs["start_at"] - datetime.now(UTC)).total_seconds()) < 5
