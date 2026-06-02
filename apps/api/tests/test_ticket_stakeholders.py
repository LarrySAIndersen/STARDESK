"""Unit tests for ticket stakeholder mention parsing and list filters."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from star_itsm_api.core.security import ROLE_AGENT, ROLE_SUBMITTER, ROLE_TOP_ADMIN, get_current_user
from star_itsm_api.main import app
from star_itsm_api.models.user import User
from star_itsm_api.schemas.stakeholder import TicketStakeholderRead
from star_itsm_api.services.ticket_stakeholders import (
    _extract_mention_tokens,
    empty_stakeholders_grouped,
    get_ticket_stakeholders_grouped,
    resolve_mentioned_user_ids,
)


def test_extract_mention_tokens_email_and_name() -> None:
    body = "Hej @anna@example.dk og @Anders Andersen — tjek dette"
    tokens = _extract_mention_tokens(body)
    assert "anna@example.dk" in tokens
    assert any("Anders" in t for t in tokens)


@pytest.mark.asyncio
async def test_resolve_mentioned_user_ids_by_email() -> None:
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email="anna@example.dk",
        display_name="Anna Agent",
        role="agent",
        is_active=True,
        password_hash=None,
        must_change_password=False,
        password_policy_exempt=False,
        organization_id=None,
        avatar_url=None,
        avatar_preset_id=None,
        ui_mode=None,
        deleted_at=None,
    )
    mock_db = AsyncMock()
    mock_result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [user]))
    mock_db.execute = AsyncMock(return_value=mock_result)

    ids = await resolve_mentioned_user_ids(mock_db, "Ping @anna@example.dk")
    assert ids == [user_id]


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


@pytest.mark.asyncio
async def test_list_tickets_stakeholder_me_success(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    app.dependency_overrides[get_current_user] = _fake_agent
    mock_scalars = SimpleNamespace(all=lambda: [])
    mock_result = SimpleNamespace(scalars=lambda: mock_scalars)
    override_db.execute = AsyncMock(return_value=mock_result)

    with patch(
        "star_itsm_api.routers.tickets.tickets_to_read_list",
        new_callable=AsyncMock,
        return_value=[],
    ):
        try:
            response = await api_client.get("/api/v1/tickets?stakeholder=me")
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_list_tickets_involving_user_forbidden_for_agent(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    app.dependency_overrides[get_current_user] = _fake_agent
    other_id = uuid.uuid4()
    try:
        response = await api_client.get(f"/api/v1/tickets?involving_user_id={other_id}")
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 403


def _fake_submitter() -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        email="user@example.dk",
        display_name="Bruger",
        role=ROLE_SUBMITTER,
        is_active=True,
        password_hash=None,
        deleted_at=None,
        organization_id=None,
    )


@pytest.mark.asyncio
async def test_add_stakeholder_requires_staff(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    ticket_id = uuid.uuid4()
    user_id = uuid.uuid4()
    app.dependency_overrides[get_current_user] = _fake_submitter
    try:
        response = await api_client.post(
            f"/api/v1/tickets/{ticket_id}/stakeholders",
            json={"user_id": str(user_id), "role": "affected"},
        )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_add_stakeholder_happy_path(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    ticket_id = uuid.uuid4()
    user_id = uuid.uuid4()
    stakeholder_id = uuid.uuid4()
    app.dependency_overrides[get_current_user] = _fake_top_admin

    ticket = SimpleNamespace(
        id=ticket_id,
        deleted_at=None,
        reporter_user_id=uuid.uuid4(),
        organization_id=None,
        assigned_team_id=None,
    )
    override_db.get = AsyncMock(return_value=ticket)

    now = __import__("datetime").datetime.now(__import__("datetime").UTC)
    fake_row = SimpleNamespace(
        id=stakeholder_id,
        ticket_id=ticket_id,
        user_id=user_id,
        role="affected",
        created_at=now,
        deleted_at=None,
    )

    with (
        patch(
            "star_itsm_api.routers.tickets.user_can_access_ticket",
            new_callable=AsyncMock,
            return_value=True,
        ),
        patch(
            "star_itsm_api.routers.tickets.validate_stakeholder_user_ids",
            new_callable=AsyncMock,
        ),
        patch(
            "star_itsm_api.routers.tickets.upsert_stakeholder",
            new_callable=AsyncMock,
            return_value=fake_row,
        ),
        patch(
            "star_itsm_api.routers.tickets.stakeholder_to_read",
            new_callable=AsyncMock,
            return_value=TicketStakeholderRead(
                id=stakeholder_id,
                ticket_id=ticket_id,
                user_id=user_id,
                role="affected",
                display_name="Anna",
                email="anna@example.dk",
                created_at=now,
            ),
        ),
    ):
        override_db.refresh = AsyncMock()
        try:
            response = await api_client.post(
                f"/api/v1/tickets/{ticket_id}/stakeholders",
                json={"user_id": str(user_id), "role": "affected"},
            )
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 201


@pytest.mark.asyncio
async def test_get_ticket_stakeholders_grouped_returns_empty_when_query_fails() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        side_effect=Exception("relation ticket_stakeholders does not exist")
    )
    nested = AsyncMock()
    nested.__aenter__ = AsyncMock(return_value=nested)
    nested.__aexit__ = AsyncMock(return_value=False)
    mock_db.begin_nested = MagicMock(return_value=nested)

    grouped = await get_ticket_stakeholders_grouped(mock_db, uuid.uuid4())

    assert grouped == empty_stakeholders_grouped()
    assert grouped.affected == []
    assert grouped.interested == []
    assert grouped.mentioned == []


@pytest.mark.asyncio
async def test_resolve_reporter_display_name_after_stakeholders_failure() -> None:
    """Stakeholder query failure in a savepoint must not block reporter lookup."""
    from star_itsm_api.services.ticket_read import resolve_reporter_display_name

    user_id = uuid.uuid4()
    mock_db = AsyncMock()
    nested = AsyncMock()
    nested.__aenter__ = AsyncMock(return_value=nested)
    nested.__aexit__ = AsyncMock(return_value=False)
    mock_db.begin_nested = MagicMock(return_value=nested)
    mock_db.execute = AsyncMock(
        side_effect=[
            Exception("relation ticket_stakeholders does not exist"),
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=lambda: []))),
        ]
    )

    await get_ticket_stakeholders_grouped(mock_db, uuid.uuid4())
    name = await resolve_reporter_display_name(mock_db, user_id)

    assert name is None
