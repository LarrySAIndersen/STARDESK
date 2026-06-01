import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from star_itsm_api.core.security import (
    ROLE_AGENT,
    ROLE_TOP_ADMIN,
    get_current_user,
    get_current_user_session,
)
from star_itsm_api.main import app
from star_itsm_api.schemas.user_admin import (
    UserAdminListItem,
    UserAdminListResponse,
    UserAdminRead,
    UserTeamSummary,
)
from tests.prototype_test_credentials import (
    ADMIN_RESET_PASSWORD,
    CLONE_INITIAL_PASSWORD,
    PLACEHOLDER_HASH,
    TEMP_ADMIN_PASSWORD,
)

CLONE_SOURCE_ID = uuid.UUID("00000000-0000-0000-0000-000000000042")
NEW_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000043")

TARGET_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000041")




async def _fake_agent_user() -> SimpleNamespace:
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
async def test_list_users_forbidden_for_agent(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    app.dependency_overrides[get_current_user] = _fake_agent_user
    try:
        response = await api_client.get("/api/v1/users")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_list_users_success(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    sample = UserAdminListResponse(
        items=[
            UserAdminListItem(
                id=TARGET_USER_ID,
                email="sf01@example.dk",
                display_name="Anna",
                role="top_admin",
                role_label="Topadministrator",
                is_active=True,
                organization_name=None,
                team_ids=[uuid.uuid4()],
                team_names=["SF"],
            )
        ],
        total=1,
        page=1,
        page_size=50,
    )
    with patch(
        "star_itsm_api.routers.users.list_users_admin",
        new_callable=AsyncMock,
        return_value=sample,
    ):
        response = await api_client.get("/api/v1/users?q=anna")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["email"] == "sf01@example.dk"
    assert body["items"][0]["team_ids"]
    assert body["items"][0]["team_names"] == ["SF"]


@pytest.mark.asyncio
async def test_reset_password_success(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    user = SimpleNamespace(
        id=TARGET_USER_ID,
        email="sf01@example.dk",
        display_name="Anna",
        role=ROLE_TOP_ADMIN,
        is_active=True,
        password_hash=PLACEHOLDER_HASH,
        deleted_at=None,
        organization_id=None,
    )
    override_db.get = AsyncMock(return_value=user)

    with patch(
        "star_itsm_api.routers.users.set_user_password",
        new_callable=AsyncMock,
    ) as reset_mock:
        response = await api_client.post(
            f"/api/v1/users/{TARGET_USER_ID}/reset-password",
            json={"new_password": ADMIN_RESET_PASSWORD},
        )

    assert response.status_code == 204
    reset_mock.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_user_assign_top_admin_forbidden_for_admin(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    user = SimpleNamespace(
        id=TARGET_USER_ID,
        email="sf04@example.dk",
        display_name="Dorte",
        role="agent",
        is_active=True,
        password_hash=None,
        deleted_at=None,
        organization_id=None,
    )
    override_db.get = AsyncMock(return_value=user)

    response = await api_client.patch(
        f"/api/v1/users/{TARGET_USER_ID}",
        json={"role": "top_admin"},
    )

    assert response.status_code == 403
    override_db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_update_user_is_active_false_with_admin_must_change_password(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    admin = SimpleNamespace(
        id=uuid.uuid4(),
        email="admin@example.dk",
        display_name="Admin",
        role="admin",
        is_active=True,
        password_hash=None,
        deleted_at=None,
        organization_id=None,
        must_change_password=True,
    )
    target = SimpleNamespace(
        id=TARGET_USER_ID,
        email="sf01@example.dk",
        display_name="SF Operations Agent 1",
        role="agent",
        is_active=True,
        password_hash=None,
        deleted_at=None,
        organization_id=None,
        must_change_password=False,
    )

    async def _get(_model, pk):  # noqa: ANN001
        if pk == TARGET_USER_ID:
            return target
        return None

    override_db.get = AsyncMock(side_effect=_get)

    async def _admin_session() -> SimpleNamespace:
        return admin

    app.dependency_overrides[get_current_user_session] = _admin_session
    try:
        detail = UserAdminRead(
            id=TARGET_USER_ID,
            email=target.email,
            display_name=target.display_name,
            role=target.role,
            role_label="Agent",
            is_active=False,
            teams=[],
            created_at=datetime(2024, 1, 15, 10, 0, tzinfo=UTC),
        )
        with patch(
            "star_itsm_api.routers.users.get_user_admin",
            new_callable=AsyncMock,
            return_value=detail,
        ):
            response = await api_client.patch(
                f"/api/v1/users/{TARGET_USER_ID}",
                json={"is_active": False},
            )
    finally:
        app.dependency_overrides.pop(get_current_user_session, None)

    assert response.status_code == 200
    assert response.json()["is_active"] is False
    assert target.is_active is False
    assert admin.must_change_password is True


@pytest.mark.asyncio
async def test_get_user_success(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    detail = UserAdminRead(
        id=TARGET_USER_ID,
        email="sf01@example.dk",
        display_name="Anna",
        role="top_admin",
        role_label="Topadministrator",
        is_active=True,
        teams=[UserTeamSummary(id=uuid.uuid4(), name="SF")],
        created_at=datetime(2024, 1, 15, 10, 0, tzinfo=UTC),
    )
    with patch(
        "star_itsm_api.routers.users.get_user_admin",
        new_callable=AsyncMock,
        return_value=detail,
    ):
        response = await api_client.get(f"/api/v1/users/{TARGET_USER_ID}")

    assert response.status_code == 200
    assert response.json()["display_name"] == "Anna"


@pytest.mark.asyncio
async def test_create_user_success(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    created_user = UserAdminRead(
        id=NEW_USER_ID,
        email="ny@example.dk",
        display_name="Ny Bruger",
        role="agent",
        role_label="Agent",
        is_active=True,
        teams=[],
        created_at=datetime(2024, 2, 1, 10, 0, tzinfo=UTC),
    )
    with patch(
        "star_itsm_api.routers.users.create_user_admin",
        new_callable=AsyncMock,
        return_value=(created_user, "TempPass1234"),
    ):
        response = await api_client.post(
            "/api/v1/users",
            json={
                "email": "ny@example.dk",
                "display_name": "Ny Bruger",
                "role": "agent",
                "is_active": True,
                "team_ids": [],
            },
        )

    assert response.status_code == 201
    body = response.json()
    assert body["user"]["email"] == "ny@example.dk"
    assert body["temporary_password"] == TEMP_ADMIN_PASSWORD


@pytest.mark.asyncio
async def test_create_user_email_conflict(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    with patch(
        "star_itsm_api.routers.users.create_user_admin",
        new_callable=AsyncMock,
        side_effect=ValueError("email_taken"),
    ):
        response = await api_client.post(
            "/api/v1/users",
            json={
                "email": "eksisterer@example.dk",
                "display_name": "Dublet",
                "role": "agent",
                "is_active": True,
                "team_ids": [],
            },
        )

    assert response.status_code == 409
    assert response.json()["detail"] == "E-mail skal være unik"


@pytest.mark.asyncio
async def test_create_user_clone_applies_source_settings(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    team_id = uuid.uuid4()
    source = UserAdminRead(
        id=CLONE_SOURCE_ID,
        email="kilde@example.dk",
        display_name="Kilde",
        role="admin",
        role_label="Administrator",
        is_active=True,
        organization_id=uuid.uuid4(),
        organization_name="STAR",
        teams=[UserTeamSummary(id=team_id, name="SF")],
        created_at=datetime(2024, 1, 1, 10, 0, tzinfo=UTC),
    )
    created_user = UserAdminRead(
        id=NEW_USER_ID,
        email="kopia-af-kilde@example.dk",
        display_name="Kilde (kopi)",
        role="admin",
        role_label="Administrator",
        is_active=True,
        organization_id=source.organization_id,
        organization_name="STAR",
        teams=source.teams,
        created_at=datetime(2024, 2, 1, 10, 0, tzinfo=UTC),
    )

    with (
        patch(
            "star_itsm_api.routers.users.get_user_admin",
            new_callable=AsyncMock,
            return_value=source,
        ),
        patch(
            "star_itsm_api.routers.users.create_user_admin",
            new_callable=AsyncMock,
            return_value=(created_user, None),
        ) as create_mock,
    ):
        response = await api_client.post(
            "/api/v1/users",
            json={
                "email": "kopia-af-kilde@example.dk",
                "display_name": "Kilde (kopi)",
                "role": "agent",
                "is_active": True,
                "organization_id": None,
                "team_ids": [],
                "clone_from_user_id": str(CLONE_SOURCE_ID),
                "initial_password": CLONE_INITIAL_PASSWORD,
            },
        )

    assert response.status_code == 201
    create_mock.assert_awaited_once()
    kwargs = create_mock.await_args.kwargs
    assert kwargs["role"] == "admin"
    assert kwargs["organization_id"] == source.organization_id
    assert kwargs["team_ids"] == [team_id]
    assert kwargs["initial_password"] == CLONE_INITIAL_PASSWORD


@pytest.mark.asyncio
async def test_import_users_success(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    from star_itsm_api.schemas.user_admin import UserImportResult

    sample = UserImportResult(
        total=1,
        created=1,
        updated=0,
        skipped=0,
        failed=0,
        errors=[],
    )
    with patch(
        "star_itsm_api.routers.users.import_users_admin",
        new_callable=AsyncMock,
        return_value=sample,
    ):
        response = await api_client.post(
            "/api/v1/users/import",
            json={
                "rows": [{"email": "import@example.dk", "display_name": "Import Test"}],
            },
        )

    assert response.status_code == 200
    assert response.json()["created"] == 1


@pytest.mark.asyncio
async def test_create_user_assign_top_admin_forbidden_for_admin(
    override_db: AsyncMock,
    api_client: AsyncClient,
) -> None:
    response = await api_client.post(
        "/api/v1/users",
        json={
            "email": "top@example.dk",
            "display_name": "Top",
            "role": "top_admin",
            "is_active": True,
            "team_ids": [],
        },
    )

    assert response.status_code == 403
