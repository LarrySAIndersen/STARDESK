"""Tests for the stable integration API contract."""

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from star_itsm_api.core.config import settings
from star_itsm_api.main import app
from star_itsm_api.schemas.integration_api import IntegrationExternalRef
from star_itsm_api.services.integration_api import (
    build_integration_metadata,
    parse_ticket_ref,
    read_external_ref,
    ticket_to_integration_read,
)


@pytest.fixture
def integration_key(monkeypatch: pytest.MonkeyPatch) -> str:
    monkeypatch.setattr(settings, "integration_api_key", "test-integration-key")
    return "test-integration-key"


@pytest.fixture
async def integration_client(
    integration_key: str,
    override_db: AsyncMock,
) -> AsyncClient:
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={
            "X-Integration-Key": integration_key,
            "X-Integration-System": "topdesk",
        },
    ) as client:
        yield client


def test_parse_ticket_ref_uuid() -> None:
    ticket_id = str(uuid.uuid4())
    mode, value, external = parse_ticket_ref(ticket_id)
    assert mode == "id"
    assert value == ticket_id
    assert external is None


def test_parse_ticket_ref_external() -> None:
    mode, system, external_id = parse_ticket_ref("ext:topdesk:INC-42")
    assert mode == "ext"
    assert system == "topdesk"
    assert external_id == "INC-42"


def test_read_external_ref_from_integration_block() -> None:
    metadata = build_integration_metadata(
        IntegrationExternalRef(system="topdesk", external_id="INC-9")
    )
    ref = read_external_ref(metadata)
    assert ref is not None
    assert ref.system == "topdesk"
    assert ref.external_id == "INC-9"


def test_read_external_ref_legacy_external_number() -> None:
    ref = read_external_ref({"external_number": "LEG-1"})
    assert ref is not None
    assert ref.system == "legacy"
    assert ref.external_id == "LEG-1"


@pytest.mark.asyncio
async def test_integration_profile_requires_key(
    monkeypatch: pytest.MonkeyPatch,
    override_db: AsyncMock,
) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "integration_api_key", "expected-key")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        denied = await client.get("/api/v1/integration/profile")
        assert denied.status_code == 401
        allowed = await client.get(
            "/api/v1/integration/profile",
            headers={"X-Integration-Key": "expected-key"},
        )
        assert allowed.status_code == 200
        body = allowed.json()
        assert body["contract"] == "stardesk-integration-v1"
        assert "case-types" in body["case_types"] or "incident" in body["case_types"]


@pytest.mark.asyncio
async def test_integration_case_types(integration_client: AsyncClient) -> None:
    response = await integration_client.get("/api/v1/integration/case-types")
    assert response.status_code == 200
    items = response.json()
    assert len(items) == 3
    assert {item["id"] for item in items} == {"incident", "service_request", "problem"}


@pytest.mark.asyncio
async def test_integration_create_and_get_ticket(
    integration_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    org_id = uuid.uuid4()
    monkeypatch.setattr(settings, "integration_org_id", str(org_id))

    ticket_id = uuid.uuid4()
    now = datetime.now(UTC)
    ticket = SimpleNamespace(
        id=ticket_id,
        ticket_number="INC-9001",
        ticket_type="incident",
        title="Printer offline",
        description="Floor 2 printer does not respond",
        status="new",
        priority="medium",
        category_id=None,
        assigned_team_id=None,
        assigned_user_id=None,
        routing_metadata=build_integration_metadata(
            IntegrationExternalRef(system="topdesk", external_id="TD-9001")
        ),
        organization_id=org_id,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )

    with (
        patch(
            "star_itsm_api.routers.integration_api.resolve_integration_organization_id",
            new=AsyncMock(return_value=org_id),
        ),
        patch(
            "star_itsm_api.routers.integration_api.create_integration_ticket",
            new=AsyncMock(return_value=ticket_to_integration_read(ticket)),
        ),
        patch(
            "star_itsm_api.routers.integration_api.get_ticket_for_integration",
            new=AsyncMock(return_value=ticket),
        ),
    ):
        create_response = await integration_client.post(
            "/api/v1/integration/tickets",
            json={
                "ticket_type": "incident",
                "title": "Printer offline",
                "description": "Floor 2 printer does not respond",
                "external_ref": {"system": "topdesk", "external_id": "TD-9001"},
            },
        )
        assert create_response.status_code == 201
        created = create_response.json()
        assert created["ticket_number"] == "INC-9001"
        assert created["external_ref"]["external_id"] == "TD-9001"

        get_response = await integration_client.get(f"/api/v1/integration/tickets/{ticket_id}")
        assert get_response.status_code == 200

        ext_response = await integration_client.get(
            "/api/v1/integration/tickets/ext:topdesk:TD-9001"
        )
        assert ext_response.status_code == 200


@pytest.mark.asyncio
async def test_openapi_includes_integration_security_scheme(
    integration_client: AsyncClient,
) -> None:
    response = await integration_client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert "IntegrationApiKey" in schema["components"]["securitySchemes"]
    assert "/api/v1/integration/profile" in schema["paths"]
