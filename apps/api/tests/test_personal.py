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
                    note_number="IDE-2026-00001",
                    title="Ring til KMD",
                    content="Følg op på sag 123",
                    is_pinned=True,
                    sort_order=0,
                    color="yellow",
                    category=None,
                    ticket_id=None,
                    visibility="private",
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
            note_number="IDE-2026-00002",
            title=payload.title,
            content=payload.content,
            is_pinned=False,
            sort_order=0,
            color=None,
            category=payload.category,
            ticket_id=None,
            visibility="private",
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


@pytest.mark.asyncio
async def test_update_personal_note_success(
    api_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _user(role=ROLE_AGENT)
    note_id = uuid.uuid4()

    def _as_user():
        return user

    app.dependency_overrides[get_current_user] = _as_user
    app.dependency_overrides[get_current_user_session] = _as_user

    now = datetime.now(UTC)
    from star_itsm_api.schemas.personal import PersonalNoteRead

    monkeypatch.setattr(
        personal_service,
        "update_note",
        AsyncMock(
            return_value=PersonalNoteRead(
                id=note_id,
                user_id=user.id,
                note_number="IDE-2026-00003",
                title="Opdateret",
                content="Nyt indhold",
                is_pinned=False,
                sort_order=1,
                color=None,
                category=None,
                ticket_id=None,
                visibility="private",
                created_at=now,
                updated_at=now,
            )
        ),
    )

    response = await api_client.patch(
        f"/api/v1/personal/notes/{note_id}",
        json={"title": "Opdateret"},
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Opdateret"


@pytest.mark.asyncio
async def test_update_personal_note_not_found(
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
        "update_note",
        AsyncMock(side_effect=LookupError("note_not_found")),
    )

    response = await api_client.patch(
        f"/api/v1/personal/notes/{uuid.uuid4()}",
        json={"title": "X"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_personal_note_team_visibility_forbidden(
    api_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _user(role=ROLE_SUBMITTER)

    def _as_user():
        return user

    app.dependency_overrides[get_current_user] = _as_user
    app.dependency_overrides[get_current_user_session] = _as_user

    monkeypatch.setattr(
        personal_service,
        "update_note",
        AsyncMock(side_effect=PermissionError("team_visibility_requires_staff")),
    )

    response = await api_client.patch(
        f"/api/v1/personal/notes/{uuid.uuid4()}",
        json={"visibility": "team"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_list_ticket_post_its(
    api_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _user(role=ROLE_AGENT)
    ticket_id = uuid.uuid4()

    def _as_user():
        return user

    app.dependency_overrides[get_current_user] = _as_user
    app.dependency_overrides[get_current_user_session] = _as_user

    now = datetime.now(UTC)
    from star_itsm_api.schemas.personal import PersonalNoteRead

    monkeypatch.setattr(
        personal_service,
        "list_ticket_post_its",
        AsyncMock(
            return_value=[
                PersonalNoteRead(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    note_number="IDE-2026-00010",
                    title="Post-it",
                    content="Husk at ringe",
                    is_pinned=False,
                    sort_order=0,
                    color="yellow",
                    category=None,
                    ticket_id=ticket_id,
                    visibility="private",
                    created_at=now,
                    updated_at=now,
                )
            ]
        ),
    )

    response = await api_client.get(f"/api/v1/personal/tickets/{ticket_id}/post-its")
    assert response.status_code == 200
    assert response.json()[0]["title"] == "Post-it"


@pytest.mark.asyncio
async def test_list_ticket_post_its_ticket_not_found(
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
        "list_ticket_post_its",
        AsyncMock(side_effect=LookupError("ticket_not_found")),
    )

    response = await api_client.get(f"/api/v1/personal/tickets/{uuid.uuid4()}/post-its")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_summarize_ticket_post_its(
    api_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _user(role=ROLE_AGENT)
    ticket_a = uuid.uuid4()
    ticket_b = uuid.uuid4()

    def _as_user():
        return user

    app.dependency_overrides[get_current_user] = _as_user
    app.dependency_overrides[get_current_user_session] = _as_user

    from star_itsm_api.schemas.personal import TicketPostItSummary

    monkeypatch.setattr(
        personal_service,
        "summarize_ticket_post_its",
        AsyncMock(
            return_value=[
                TicketPostItSummary(ticket_id=ticket_a, count=2),
                TicketPostItSummary(ticket_id=ticket_b, count=1),
            ]
        ),
    )

    response = await api_client.get(
        f"/api/v1/personal/ticket-post-its/summary?ticket_ids={ticket_a},{ticket_b}"
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    assert body[0]["count"] == 2


@pytest.mark.asyncio
async def test_add_kanban_card_success(
    api_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _user(role=ROLE_AGENT)
    ticket_id = uuid.uuid4()

    def _as_user():
        return user

    app.dependency_overrides[get_current_user] = _as_user
    app.dependency_overrides[get_current_user_session] = _as_user

    from star_itsm_api.schemas.personal import PersonalKanbanCardRead

    monkeypatch.setattr(
        personal_service,
        "add_kanban_card",
        AsyncMock(
            return_value=PersonalKanbanCardRead(
                user_id=user.id,
                ticket_id=ticket_id,
                column_name="Min kø",
                sort_order=0,
                created_at=datetime.now(UTC),
            )
        ),
    )

    response = await api_client.post(
        "/api/v1/personal/kanban/cards",
        json={"ticket_id": str(ticket_id), "column_name": "Min kø"},
    )
    assert response.status_code == 201
    assert response.json()["ticket_id"] == str(ticket_id)


@pytest.mark.asyncio
async def test_add_kanban_card_already_on_board(
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
        "add_kanban_card",
        AsyncMock(side_effect=ValueError("ticket_already_on_board")),
    )

    response = await api_client.post(
        "/api/v1/personal/kanban/cards",
        json={"ticket_id": str(uuid.uuid4())},
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_add_kanban_card_invalid_column(
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
        "add_kanban_card",
        AsyncMock(side_effect=ValueError("invalid_column")),
    )

    response = await api_client.post(
        "/api/v1/personal/kanban/cards",
        json={"ticket_id": str(uuid.uuid4()), "column_name": "Ukendt"},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_move_kanban_card_success(
    api_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _user(role=ROLE_AGENT)
    ticket_id = uuid.uuid4()

    def _as_user():
        return user

    app.dependency_overrides[get_current_user] = _as_user
    app.dependency_overrides[get_current_user_session] = _as_user

    from star_itsm_api.schemas.personal import PersonalKanbanCardRead

    monkeypatch.setattr(
        personal_service,
        "move_kanban_card",
        AsyncMock(
            return_value=PersonalKanbanCardRead(
                user_id=user.id,
                ticket_id=ticket_id,
                column_name="Færdig",
                sort_order=1,
                created_at=datetime.now(UTC),
            )
        ),
    )

    response = await api_client.patch(
        f"/api/v1/personal/kanban/cards/{ticket_id}",
        json={"column_name": "Færdig"},
    )
    assert response.status_code == 200
    assert response.json()["column_name"] == "Færdig"


@pytest.mark.asyncio
async def test_move_kanban_card_not_found(
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
        "move_kanban_card",
        AsyncMock(side_effect=LookupError("card_not_found")),
    )

    response = await api_client.patch(
        f"/api/v1/personal/kanban/cards/{uuid.uuid4()}",
        json={"column_name": "Færdig"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_remove_kanban_card_success(
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
        "remove_kanban_card",
        AsyncMock(return_value=None),
    )

    response = await api_client.delete(f"/api/v1/personal/kanban/cards/{uuid.uuid4()}")
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_remove_kanban_card_not_found(
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
        "remove_kanban_card",
        AsyncMock(side_effect=LookupError("card_not_found")),
    )

    response = await api_client.delete(f"/api/v1/personal/kanban/cards/{uuid.uuid4()}")
    assert response.status_code == 404
