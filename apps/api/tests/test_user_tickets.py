import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from star_itsm_api.core.security import ROLE_AGENT, ROLE_TOP_ADMIN, get_current_user
from star_itsm_api.main import app
from star_itsm_api.schemas.ticket import TicketRead
from star_itsm_api.schemas.user_admin import UserTicketsGroupedRead

TARGET_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000099")
OTHER_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000088")




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
async def test_get_user_tickets_forbidden_for_other_agent(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    app.dependency_overrides[get_current_user] = _fake_agent
    try:
        response = await api_client.get(f"/api/v1/users/{TARGET_USER_ID}/tickets")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_get_user_tickets_success(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    app.dependency_overrides[get_current_user] = _fake_top_admin
    sample_ticket = TicketRead(
        id=uuid.uuid4(),
        ticket_number="INC-1001",
        title="Test sag",
        status="new",
        priority="medium",
        ticket_type="incident",
        created_at=datetime.now(UTC),
    )
    grouped = UserTicketsGroupedRead(reported=[sample_ticket])

    with (
        patch(
            "star_itsm_api.routers.users.get_user_admin",
            new_callable=AsyncMock,
            return_value=SimpleNamespace(id=TARGET_USER_ID),
        ),
        patch(
            "star_itsm_api.routers.users.list_user_tickets_grouped",
            new_callable=AsyncMock,
            return_value=grouped,
        ),
    ):
        try:
            response = await api_client.get(f"/api/v1/users/{TARGET_USER_ID}/tickets")
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    body = response.json()
    assert len(body["reported"]) == 1
    assert body["reported"][0]["ticket_number"] == "INC-1001"


@pytest.mark.asyncio
async def test_create_ticket_sets_reporter_to_current_user(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    actor_id = uuid.uuid4()
    added: list[object] = []

    def _fake_actor() -> SimpleNamespace:
        return SimpleNamespace(
            id=actor_id,
            email="user@example.dk",
            display_name="Indmelder",
            role=ROLE_AGENT,
            is_active=True,
            password_hash=None,
            deleted_at=None,
            organization_id=None,
        )

    app.dependency_overrides[get_current_user] = _fake_actor

    def _track_add(obj: object) -> None:
        added.append(obj)

    override_db.add = _track_add
    override_db.flush = AsyncMock()
    override_db.commit = AsyncMock()
    override_db.refresh = AsyncMock()

    with (
        patch(
            "star_itsm_api.routers.tickets.apply_routing",
            new_callable=AsyncMock,
            return_value=SimpleNamespace(
                assigned_team_id=None,
                assigned_user_id=None,
                priority="medium",
            ),
        ),
        patch(
            "star_itsm_api.routers.tickets.validate_sub_cause_ids",
            new_callable=AsyncMock,
        ),
        patch(
            "star_itsm_api.routers.tickets.generate_ticket_number",
            new_callable=AsyncMock,
            return_value="INC-2001",
        ),
        patch(
            "star_itsm_api.routers.tickets.apply_sla_to_ticket",
            new_callable=AsyncMock,
        ),
        patch(
            "star_itsm_api.routers.tickets.sync_ticket_stakeholders_on_create",
            new_callable=AsyncMock,
        ),
        patch(
            "star_itsm_api.routers.tickets.ticket_to_read",
            new_callable=AsyncMock,
            return_value=TicketRead(
                id=uuid.uuid4(),
                ticket_number="INC-2001",
                title="Ny sag",
                status="new",
                priority="medium",
                ticket_type="incident",
                reporter_user_id=actor_id,
                reporter_display_name="Indmelder",
                created_at=datetime.now(UTC),
            ),
        ),
    ):
        try:
            response = await api_client.post(
                "/api/v1/tickets",
                json={
                    "title": "Ny test sag",
                    "description": "Beskrivelse med nok tegn til validering.",
                    "gdpr_consent": True,
                },
            )
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    ticket_rows = [obj for obj in added if hasattr(obj, "reporter_user_id")]
    assert ticket_rows, "Expected Ticket to be added to session"
    assert ticket_rows[0].reporter_user_id == actor_id
    assert response.status_code == 201
    assert response.json()["reporter_display_name"] == "Indmelder"
