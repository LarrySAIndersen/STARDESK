"""API tests for Stardesk Reviewer page review notes."""

import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from star_itsm_api.core.security import (
    ROLE_AGENT,
    ROLE_STARDESK_REVIEWER,
    get_current_user,
    get_current_user_session,
)
from star_itsm_api.deps import require_db
from star_itsm_api.main import app
from star_itsm_api.services import review_notes as review_notes_service


@pytest.fixture
def mock_db() -> AsyncMock:
    session = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    return session


@pytest.fixture
def override_db(mock_db: AsyncMock):
    async def _require_db() -> AsyncMock:
        return mock_db

    app.dependency_overrides[require_db] = _require_db
    yield mock_db
    app.dependency_overrides.pop(require_db, None)


@pytest.fixture
async def api_client(override_db: AsyncMock) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


def _reviewer_user() -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        email="reviewer@example.dk",
        display_name="Rita Reviewer",
        role=ROLE_STARDESK_REVIEWER,
        is_active=True,
        password_hash=None,
        deleted_at=None,
        must_change_password=False,
        password_policy_exempt=False,
    )


def _agent_user() -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        email="agent@example.dk",
        display_name="Agent",
        role=ROLE_AGENT,
        is_active=True,
        password_hash=None,
        deleted_at=None,
        must_change_password=False,
        password_policy_exempt=False,
    )


@pytest.mark.asyncio
async def test_create_review_note_happy_path(
    api_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    reviewer = _reviewer_user()

    async def _as_reviewer():
        return reviewer

    app.dependency_overrides[get_current_user] = _as_reviewer
    app.dependency_overrides[get_current_user_session] = _as_reviewer

    now = datetime.now(UTC)

    async def _fake_create(db, *, payload, author):  # noqa: ANN001
        assert payload.page_path == "/tickets"
        assert author.role == ROLE_STARDESK_REVIEWER
        from star_itsm_api.schemas.review_note import ReviewNoteRead

        return ReviewNoteRead(
            id=uuid.uuid4(),
            page_path="/tickets",
            page_title="Alle sager",
            comment="Knappen er for lille",
            position_x=120.0,
            position_y=340.0,
            position_selector=None,
            status="open",
            created_by_user_id=reviewer.id,
            created_by_name=reviewer.display_name,
            created_by_email=reviewer.email,
            created_at=now,
            updated_at=now,
        )

    monkeypatch.setattr(review_notes_service, "create_review_note", _fake_create)

    response = await api_client.post(
        "/api/v1/review-notes",
        json={
            "page_path": "/tickets",
            "page_title": "Alle sager",
            "comment": "Knappen er for lille",
            "position_x": 120,
            "position_y": 340,
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["page_path"] == "/tickets"
    assert body["created_by_name"] == "Rita Reviewer"
    assert body["status"] == "open"


@pytest.mark.asyncio
async def test_create_review_note_forbidden_for_agent(api_client: AsyncClient) -> None:
    agent = _agent_user()

    async def _as_agent():
        return agent

    app.dependency_overrides[get_current_user] = _as_agent
    app.dependency_overrides[get_current_user_session] = _as_agent

    response = await api_client.post(
        "/api/v1/review-notes",
        json={
            "page_path": "/",
            "page_title": "Dashboard",
            "comment": "Test",
            "position_x": 10,
            "position_y": 20,
        },
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_list_review_notes_for_staff(
    api_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    agent = _agent_user()

    async def _as_agent():
        return agent

    app.dependency_overrides[get_current_user] = _as_agent
    app.dependency_overrides[get_current_user_session] = _as_agent

    async def _fake_list(db, *, page_path=None, status=None):  # noqa: ANN001
        from star_itsm_api.schemas.review_note import ReviewNoteRead

        now = datetime.now(UTC)
        return [
            ReviewNoteRead(
                id=uuid.uuid4(),
                page_path="/service-desk",
                page_title="Service Desk",
                comment="Filter mangler",
                position_x=50.0,
                position_y=80.0,
                position_selector=None,
                status="open",
                created_by_user_id=uuid.uuid4(),
                created_by_name="Rita Reviewer",
                created_by_email="reviewer@example.dk",
                created_at=now,
                updated_at=now,
            )
        ]

    monkeypatch.setattr(review_notes_service, "list_review_notes", _fake_list)

    response = await api_client.get("/api/v1/review-notes")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["page_title"] == "Service Desk"
