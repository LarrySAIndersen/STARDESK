"""API tests for personal workspace (Min side)."""

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from star_itsm_api.core.security import (
    ROLE_AGENT,
    ROLE_SUBMITTER,
    get_current_user,
    get_current_user_session,
)
from star_itsm_api.main import app
from star_itsm_api.services import personal_service


def _user(*, role: str) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        email="user@example.dk",
        display_name="Test User",
        role=role,
        is_active=True,
        password_hash=None,
        deleted_at=None,
        must_change_password=False,
        password_policy_exempt=False,
    )


@pytest.mark.asyncio
async def test_list_personal_notes(
    api_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _user(role=ROLE_AGENT)

    def _as_user():
        return user

    app.dependency_overrides[get_current_user] = _as_user
    app.dependency_overrides[get_current_user_session] = _as_user

    now = datetime.now(UTC)
    from star_itsm_api.schemas.personal import PersonalNoteRead

    monkeypatch.setattr(
        personal_service,
        "list_notes",
        AsyncMock(
            return_value=[
                PersonalNoteRead(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    title="Ring til KMD",
                    content="Følg op på sag 123",
                    is_pinned=True,
                    sort_order=0,
                    color="yellow",
                    created_at=now,
                    updated_at=now,
                )
            ]
        ),
    )

    response = await api_client.get("/api/v1/personal/notes")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["title"] == "Ring til KMD"
    assert body[0]["is_pinned"] is True


@pytest.mark.asyncio
async def test_create_personal_note(
    api_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    end_user = _user(role=ROLE_SUBMITTER)

    def _as_user():
        return end_user

    app.dependency_overrides[get_current_user] = _as_user
    app.dependency_overrides[get_current_user_session] = _as_user

    now = datetime.now(UTC)
    from star_itsm_api.schemas.personal import PersonalNoteRead

    def _fake_create(db, user, payload):  # noqa: ANN001
        assert user.id == end_user.id
        assert payload.title == "Husk password reset"
        return PersonalNoteRead(
            id=uuid.uuid4(),
            user_id=end_user.id,
            title=payload.title,
            content=payload.content,
            is_pinned=False,
            sort_order=0,
            color=None,
            created_at=now,
            updated_at=now,
        )

    monkeypatch.setattr(
        personal_service,
        "create_note",
        AsyncMock(side_effect=_fake_create),
    )

    response = await api_client.post(
        "/api/v1/personal/notes",
        json={"title": "Husk password reset", "content": "Til mandag"},
    )
    assert response.status_code == 201
    assert response.json()["title"] == "Husk password reset"


@pytest.mark.asyncio
async def test_delete_personal_note_not_found(
    api_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _user(role=ROLE_AGENT)

    def _as_user():
        return user

    app.dependency_overrides[get_current_user] = _as_user
    app.dependency_overrides[get_current_user_session] = _as_user

    monkeypatch.setattr(
        personal_service,
        "delete_note",
        AsyncMock(side_effect=LookupError("note_not_found")),
    )

    response = await api_client.delete(f"/api/v1/personal/notes/{uuid.uuid4()}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_personal_kanban(
    api_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _user(role=ROLE_AGENT)

    def _as_user():
        return user

    app.dependency_overrides[get_current_user] = _as_user
    app.dependency_overrides[get_current_user_session] = _as_user

    from star_itsm_api.schemas.personal import PersonalKanbanRead

    monkeypatch.setattr(
        personal_service,
        "get_personal_kanban",
        AsyncMock(
            return_value=PersonalKanbanRead(
                columns=["Min kø", "I gang", "Færdig"],
                cards=[],
                tickets=[],
            )
        ),
    )

    response = await api_client.get("/api/v1/personal/kanban")
    assert response.status_code == 200
    body = response.json()
    assert body["columns"] == ["Min kø", "I gang", "Færdig"]
