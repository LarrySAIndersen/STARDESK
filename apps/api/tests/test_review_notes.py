"""API tests for Stardesk Reviewer page review notes."""

import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from star_itsm_api.core.security import (
    ROLE_ADMIN,
    ROLE_AGENT,
    ROLE_STARDESK_REVIEWER,
    get_current_user,
    get_current_user_session,
)
from star_itsm_api.main import app
from star_itsm_api.services import review_notes as review_notes_service


@pytest.fixture
async def unauthenticated_client(override_db: AsyncMock) -> AsyncIterator[AsyncClient]:
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_current_user_session, None)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


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


def _admin_user() -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        email="admin@example.dk",
        display_name="Admin",
        role=ROLE_ADMIN,
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

    def _as_reviewer():
        return reviewer

    app.dependency_overrides[get_current_user] = _as_reviewer
    app.dependency_overrides[get_current_user_session] = _as_reviewer

    now = datetime.now(UTC)

    def _fake_create(db, *, payload, author):  # noqa: ANN001
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
            has_screenshot=False,
            created_by_user_id=reviewer.id,
            created_by_name=reviewer.display_name,
            created_by_email=reviewer.email,
            created_at=now,
            updated_at=now,
        )

    monkeypatch.setattr(
        review_notes_service,
        "create_review_note",
        AsyncMock(side_effect=_fake_create),
    )

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

    def _as_agent():
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

    def _as_agent():
        return agent

    app.dependency_overrides[get_current_user] = _as_agent
    app.dependency_overrides[get_current_user_session] = _as_agent

    def _fake_list(db, *, page_path=None, status=None):  # noqa: ANN001
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
                has_screenshot=False,
                created_by_user_id=uuid.uuid4(),
                created_by_name="Rita Reviewer",
                created_by_email="reviewer@example.dk",
                created_at=now,
                updated_at=now,
            )
        ]

    monkeypatch.setattr(
        review_notes_service,
        "list_review_notes",
        AsyncMock(side_effect=_fake_list),
    )

    response = await api_client.get("/api/v1/review-notes")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["page_title"] == "Service Desk"


@pytest.mark.asyncio
async def test_download_review_note_screenshot_requires_auth(
    unauthenticated_client: AsyncClient,
) -> None:
    response = await unauthenticated_client.get(
        f"/api/v1/review-notes/{uuid.uuid4()}/screenshot",
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_delete_review_note_happy_path_for_admin(
    api_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    admin = _admin_user()
    note_id = uuid.uuid4()

    def _as_admin():
        return admin

    app.dependency_overrides[get_current_user] = _as_admin
    app.dependency_overrides[get_current_user_session] = _as_admin

    delete_mock = AsyncMock(return_value=None)
    monkeypatch.setattr(review_notes_service, "delete_review_note", delete_mock)

    response = await api_client.delete(f"/api/v1/review-notes/{note_id}")

    assert response.status_code == 204
    delete_mock.assert_awaited_once()
    assert delete_mock.await_args.kwargs["note_id"] == note_id


@pytest.mark.asyncio
async def test_delete_review_note_marks_note_as_deleted(mock_db: AsyncMock) -> None:
    note = SimpleNamespace(id=uuid.uuid4(), status="open", updated_at=None)
    mock_db.get = AsyncMock(return_value=note)

    await review_notes_service.delete_review_note(mock_db, note_id=note.id)

    assert note.status == "deleted"
    assert note.updated_at is not None
    mock_db.delete.assert_not_called()
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_delete_review_note_forbidden_for_agent(api_client: AsyncClient) -> None:
    agent = _agent_user()

    def _as_agent():
        return agent

    app.dependency_overrides[get_current_user] = _as_agent
    app.dependency_overrides[get_current_user_session] = _as_agent

    response = await api_client.delete(f"/api/v1/review-notes/{uuid.uuid4()}")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_delete_review_note_requires_auth(
    unauthenticated_client: AsyncClient,
) -> None:
    response = await unauthenticated_client.delete(f"/api/v1/review-notes/{uuid.uuid4()}")
    assert response.status_code == 401
