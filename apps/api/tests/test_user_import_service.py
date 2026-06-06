"""Unit tests for user_import service helpers and import_users_admin."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from star_itsm_api.core.http_details import INVALID_GROUP
from star_itsm_api.core.security import ROLE_AGENT, ROLE_SUBMITTER, ROLE_TOP_ADMIN
from star_itsm_api.models.user import User
from star_itsm_api.schemas.user_admin import UserImportRequest, UserImportRow
from star_itsm_api.services import user_import


def test_split_names_supports_separators() -> None:
    assert user_import._split_names("A, B") == ["A", "B"]
    assert user_import._split_names("A; B") == ["A", "B"]
    assert user_import._split_names("A | B") == ["A", "B"]
    assert user_import._split_names(None) == []
    assert user_import._split_names("   ") == []


def test_team_ids_by_names_resolves_and_reports_unknown() -> None:
    team_id = uuid.uuid4()
    teams = {"support": team_id}
    ids, unknown = user_import._team_ids_by_names(
        AsyncMock(),
        ["Support", "Missing"],
        teams_by_name=teams,
    )
    assert ids == [team_id]
    assert unknown == ["Missing"]


@pytest.mark.asyncio
async def test_import_users_admin_rejects_invalid_rows() -> None:
    mock_db = AsyncMock()
    teams_result = MagicMock()
    teams_result.all.return_value = []
    orgs_result = MagicMock()
    orgs_result.all.return_value = []
    mock_db.execute = AsyncMock(side_effect=[teams_result, orgs_result])

    payload = UserImportRequest(
        rows=[
            UserImportRow(email="bad-email", display_name="X"),
            UserImportRow(email="ok@example.dk", display_name="   "),
            UserImportRow(email="role@example.dk", display_name="R", role="not-a-role"),
            UserImportRow(email="top@example.dk", display_name="T", role=ROLE_TOP_ADMIN),
        ],
        default_role=ROLE_SUBMITTER,
        on_duplicate="skip",
    )
    result = await user_import.import_users_admin(mock_db, payload=payload, _actor_role="admin")
    assert result.failed == 4
    assert result.created == 0
    messages = {err.message for err in result.errors}
    assert "Ugyldig e-mail" in messages
    assert "Navn mangler" in messages
    assert any("Ukendt rolle" in msg for msg in messages)
    assert any("Topadministrator" in msg for msg in messages)


@pytest.mark.asyncio
async def test_import_users_admin_rejects_unknown_team_and_org() -> None:
    mock_db = AsyncMock()
    team_id = uuid.uuid4()
    teams_result = MagicMock()
    teams_result.all.return_value = [(team_id, "Support")]
    orgs_result = MagicMock()
    orgs_result.all.return_value = [(uuid.uuid4(), "STAR")]
    mock_db.execute = AsyncMock(side_effect=[teams_result, orgs_result])
    mock_db.commit = AsyncMock()

    payload = UserImportRequest(
        rows=[
            UserImportRow(
                email="team@example.dk",
                display_name="Team",
                teams="Unknown Team",
            ),
            UserImportRow(
                email="org@example.dk",
                display_name="Org",
                organization="Missing Org",
            ),
        ],
        default_role=ROLE_SUBMITTER,
        on_duplicate="skip",
    )
    result = await user_import.import_users_admin(mock_db, payload=payload, _actor_role="admin")
    assert result.failed == 2
    assert any("Ukendt gruppe" in err.message for err in result.errors)
    assert any("Ukendt organisation" in err.message for err in result.errors)


@pytest.mark.asyncio
async def test_import_users_admin_creates_user() -> None:
    mock_db = AsyncMock()
    teams_result = MagicMock()
    teams_result.all.return_value = []
    orgs_result = MagicMock()
    orgs_result.all.return_value = []
    mock_db.execute = AsyncMock(side_effect=[teams_result, orgs_result])

    with patch(
        "star_itsm_api.services.user_import._user_by_email",
        new_callable=AsyncMock,
        return_value=None,
    ), patch(
        "star_itsm_api.services.user_import.email_taken",
        new_callable=AsyncMock,
        return_value=False,
    ), patch(
        "star_itsm_api.services.user_import.create_user_admin",
        new_callable=AsyncMock,
    ) as mock_create:
        payload = UserImportRequest(
            rows=[UserImportRow(email="new@example.dk", display_name="Ny Bruger", role="agent")],
            default_role=ROLE_SUBMITTER,
            on_duplicate="skip",
        )
        result = await user_import.import_users_admin(mock_db, payload=payload, _actor_role="admin")

    assert result.created == 1
    assert result.failed == 0
    mock_create.assert_awaited_once()
    assert mock_create.await_args.kwargs["role"] == ROLE_AGENT


@pytest.mark.asyncio
async def test_import_users_admin_updates_existing_on_duplicate() -> None:
    mock_db = AsyncMock()
    teams_result = MagicMock()
    teams_result.all.return_value = []
    orgs_result = MagicMock()
    orgs_result.all.return_value = []
    mock_db.execute = AsyncMock(side_effect=[teams_result, orgs_result])
    existing = User(id=uuid.uuid4(), email="exists@example.dk", display_name="Old", role=ROLE_SUBMITTER)

    with patch(
        "star_itsm_api.services.user_import._user_by_email",
        new_callable=AsyncMock,
        return_value=existing,
    ), patch(
        "star_itsm_api.services.user_import.sync_user_teams",
        new_callable=AsyncMock,
    ):
        payload = UserImportRequest(
            rows=[UserImportRow(email="exists@example.dk", display_name="Updated Name", role="agent")],
            default_role=ROLE_SUBMITTER,
            on_duplicate="update",
        )
        result = await user_import.import_users_admin(mock_db, payload=payload, _actor_role="admin")

    assert result.updated == 1
    assert existing.display_name == "Updated Name"
    assert existing.role == ROLE_AGENT
    mock_db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_import_users_admin_skips_existing_when_configured() -> None:
    mock_db = AsyncMock()
    teams_result = MagicMock()
    teams_result.all.return_value = []
    orgs_result = MagicMock()
    orgs_result.all.return_value = []
    mock_db.execute = AsyncMock(side_effect=[teams_result, orgs_result])
    existing = User(id=uuid.uuid4(), email="exists@example.dk", display_name="Old", role=ROLE_SUBMITTER)

    with patch(
        "star_itsm_api.services.user_import._user_by_email",
        new_callable=AsyncMock,
        return_value=existing,
    ):
        payload = UserImportRequest(
            rows=[UserImportRow(email="exists@example.dk", display_name="Ignored")],
            default_role=ROLE_SUBMITTER,
            on_duplicate="skip",
        )
        result = await user_import.import_users_admin(mock_db, payload=payload, _actor_role="admin")

    assert result.skipped == 1
    assert result.updated == 0


@pytest.mark.asyncio
async def test_import_users_admin_handles_create_email_taken_with_update() -> None:
    mock_db = AsyncMock()
    teams_result = MagicMock()
    teams_result.all.return_value = []
    orgs_result = MagicMock()
    orgs_result.all.return_value = []
    mock_db.execute = AsyncMock(side_effect=[teams_result, orgs_result])
    existing = User(id=uuid.uuid4(), email="race@example.dk", display_name="Old", role=ROLE_SUBMITTER)

    with patch(
        "star_itsm_api.services.user_import._user_by_email",
        new_callable=AsyncMock,
        side_effect=[None, existing],
    ), patch(
        "star_itsm_api.services.user_import.email_taken",
        new_callable=AsyncMock,
        return_value=False,
    ), patch(
        "star_itsm_api.services.user_import.create_user_admin",
        new_callable=AsyncMock,
        side_effect=ValueError("email_taken"),
    ), patch(
        "star_itsm_api.services.user_import.sync_user_teams",
        new_callable=AsyncMock,
    ):
        payload = UserImportRequest(
            rows=[UserImportRow(email="race@example.dk", display_name="Updated")],
            default_role=ROLE_SUBMITTER,
            on_duplicate="update",
        )
        result = await user_import.import_users_admin(mock_db, payload=payload, _actor_role="admin")

    assert result.updated == 1
    assert existing.display_name == "Updated"


@pytest.mark.asyncio
async def test_import_users_admin_handles_invalid_team_on_create() -> None:
    mock_db = AsyncMock()
    teams_result = MagicMock()
    teams_result.all.return_value = []
    orgs_result = MagicMock()
    orgs_result.all.return_value = []
    mock_db.execute = AsyncMock(side_effect=[teams_result, orgs_result])

    with patch(
        "star_itsm_api.services.user_import._user_by_email",
        new_callable=AsyncMock,
        return_value=None,
    ), patch(
        "star_itsm_api.services.user_import.email_taken",
        new_callable=AsyncMock,
        return_value=False,
    ), patch(
        "star_itsm_api.services.user_import.create_user_admin",
        new_callable=AsyncMock,
        side_effect=ValueError("invalid_team"),
    ):
        payload = UserImportRequest(
            rows=[UserImportRow(email="badteam@example.dk", display_name="User")],
            default_role=ROLE_SUBMITTER,
            on_duplicate="skip",
        )
        result = await user_import.import_users_admin(mock_db, payload=payload, _actor_role="admin")

    assert result.failed == 1
    assert result.errors[0].message == INVALID_GROUP


@pytest.mark.asyncio
async def test_import_users_admin_skips_when_email_taken_on_create() -> None:
    mock_db = AsyncMock()
    teams_result = MagicMock()
    teams_result.all.return_value = []
    orgs_result = MagicMock()
    orgs_result.all.return_value = []
    mock_db.execute = AsyncMock(side_effect=[teams_result, orgs_result])

    with patch(
        "star_itsm_api.services.user_import._user_by_email",
        new_callable=AsyncMock,
        return_value=None,
    ), patch(
        "star_itsm_api.services.user_import.email_taken",
        new_callable=AsyncMock,
        return_value=True,
    ):
        payload = UserImportRequest(
            rows=[UserImportRow(email="exists@example.dk", display_name="User")],
            default_role=ROLE_SUBMITTER,
            on_duplicate="skip",
        )
        result = await user_import.import_users_admin(mock_db, payload=payload, _actor_role="admin")

    assert result.skipped == 1


@pytest.mark.asyncio
async def test_import_users_admin_update_value_error_adds_invalid_group() -> None:
    mock_db = AsyncMock()
    teams_result = MagicMock()
    teams_result.all.return_value = []
    orgs_result = MagicMock()
    orgs_result.all.return_value = []
    mock_db.execute = AsyncMock(side_effect=[teams_result, orgs_result])
    existing = User(id=uuid.uuid4(), email="exists@example.dk", display_name="Old", role=ROLE_SUBMITTER)

    with patch(
        "star_itsm_api.services.user_import._user_by_email",
        new_callable=AsyncMock,
        return_value=existing,
    ), patch(
        "star_itsm_api.services.user_import.sync_user_teams",
        new_callable=AsyncMock,
        side_effect=ValueError("invalid_team"),
    ):
        payload = UserImportRequest(
            rows=[UserImportRow(email="exists@example.dk", display_name="Updated")],
            default_role=ROLE_SUBMITTER,
            on_duplicate="update",
        )
        result = await user_import.import_users_admin(mock_db, payload=payload, _actor_role="admin")

    assert result.failed == 1
    assert result.errors[0].message == INVALID_GROUP

