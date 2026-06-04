import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from star_itsm_api.models.organization import Organization
from star_itsm_api.models.team import Team
from star_itsm_api.models.team_member import TeamMember
from star_itsm_api.models.user import User
from star_itsm_api.schemas.user_admin import OrganizationOption, UserTeamSummary
from star_itsm_api.services import user_admin


def test_build_admin_meta_includes_assignable_roles() -> None:
    orgs = [OrganizationOption(id=uuid.uuid4(), name="STAR")]
    meta = user_admin.build_admin_meta(orgs)
    assert meta.organizations == orgs
    assert len(meta.roles) >= 1
    assert all(role.label for role in meta.roles)


@pytest.mark.asyncio
async def test_list_organizations() -> None:
    mock_db = AsyncMock()
    org1 = Organization(id=uuid.uuid4(), name="STAR")
    org2 = Organization(id=uuid.uuid4(), name="Other")
    
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [org1, org2]
    mock_db.execute.return_value = mock_result
    
    orgs = await user_admin.list_organizations(mock_db)
    assert len(orgs) == 2
    assert orgs[0].name == "STAR"
    assert orgs[1].name == "Other"


@pytest.mark.asyncio
async def test_team_summaries_for_users_empty() -> None:
    mock_db = AsyncMock()
    result = await user_admin._team_summaries_for_users(mock_db, [])
    assert result == {}
    mock_db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_team_summaries_for_users_with_ids() -> None:
    mock_db = AsyncMock()
    user_id = uuid.uuid4()
    team_id = uuid.uuid4()
    
    mock_result = MagicMock()
    mock_result.all.return_value = [(user_id, team_id, "Support Team")]
    mock_db.execute.return_value = mock_result
    
    result = await user_admin._team_summaries_for_users(mock_db, [user_id])
    assert user_id in result
    assert len(result[user_id]) == 1
    assert result[user_id][0].name == "Support Team"


@pytest.mark.asyncio
async def test_list_users_admin_no_search() -> None:
    mock_db = AsyncMock()
    user_id = uuid.uuid4()
    org_id = uuid.uuid4()
    user = User(
        id=user_id,
        email="test@example.com",
        display_name="Test User",
        role="staff",
        is_active=True,
        organization_id=org_id,
    )
    
    # Mock total count execute
    count_result = MagicMock()
    count_result.scalar_one.return_value = 1
    
    # Mock users execute
    users_result = MagicMock()
    users_result.scalars.return_value.all.return_value = [user]
    
    # Mock org name execute
    org = Organization(id=org_id, name="STAR")
    orgs_result = MagicMock()
    orgs_result.scalars.return_value.all.return_value = [org]
    
    mock_db.execute.side_effect = [count_result, users_result, orgs_result]
    
    with patch("star_itsm_api.services.user_admin._team_summaries_for_users") as mock_teams, \
         patch("star_itsm_api.services.user_admin.fetch_user_roles_bulk") as mock_roles:
        
        mock_teams.return_value = {user_id: [UserTeamSummary(id=uuid.uuid4(), name="Support")]}
        mock_roles.return_value = {user_id: ["staff"]}
        
        response = await user_admin.list_users_admin(mock_db, page=1, page_size=10, q=None)
        
        assert response.total == 1
        assert len(response.items) == 1
        assert response.items[0].display_name == "Test User"
        assert response.items[0].organization_name == "STAR"
        assert "Support" in response.items[0].team_names


@pytest.mark.asyncio
async def test_list_users_admin_with_search() -> None:
    mock_db = AsyncMock()
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email="test@example.com",
        display_name="Test User",
        role="staff",
        is_active=True,
    )
    
    count_result = MagicMock()
    count_result.scalar_one.return_value = 1
    
    users_result = MagicMock()
    users_result.scalars.return_value.all.return_value = [user]
    
    mock_db.execute.side_effect = [count_result, users_result]
    
    with patch("star_itsm_api.services.user_admin._team_summaries_for_users") as mock_teams, \
         patch("star_itsm_api.services.user_admin.fetch_user_roles_bulk") as mock_roles:
        
        mock_teams.return_value = {}
        mock_roles.return_value = {}
        
        response = await user_admin.list_users_admin(mock_db, page=1, page_size=10, q="test")
        assert response.total == 1


@pytest.mark.asyncio
async def test_get_user_admin_not_found() -> None:
    mock_db = AsyncMock()
    mock_db.get.return_value = None
    
    result = await user_admin.get_user_admin(mock_db, uuid.uuid4())
    assert result is None


@pytest.mark.asyncio
async def test_get_user_admin_deleted() -> None:
    mock_db = AsyncMock()
    user = User(id=uuid.uuid4(), email="deleted@example.com", deleted_at=datetime.now(UTC))
    mock_db.get.return_value = user
    
    result = await user_admin.get_user_admin(mock_db, user.id)
    assert result is None


@pytest.mark.asyncio
async def test_get_user_admin_success() -> None:
    mock_db = AsyncMock()
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email="test@example.com",
        display_name="Test User",
        role="staff",
        is_active=True,
        organization_id=org_id,
    )
    mock_db.get.side_effect = [user, Organization(id=org_id, name="STAR")]
    
    with patch("star_itsm_api.services.user_admin._team_summaries_for_users") as mock_teams, \
         patch("star_itsm_api.services.user_admin.fetch_user_roles") as mock_roles, \
         patch("star_itsm_api.services.user_admin.attach_roles_to_user") as mock_attach:
        
        mock_teams.return_value = {user_id: [UserTeamSummary(id=uuid.uuid4(), name="Support")]}
        mock_roles.return_value = ["staff"]
        
        result = await user_admin.get_user_admin(mock_db, user_id)
        assert result is not None
        assert result.display_name == "Test User"
        assert result.organization_name == "STAR"
        assert len(result.teams) == 1
        assert result.teams[0].name == "Support"


@pytest.mark.asyncio
async def test_get_user_admin_no_org() -> None:
    mock_db = AsyncMock()
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email="test@example.com",
        display_name="Test User",
        role="staff",
        is_active=True,
        organization_id=None,
    )
    mock_db.get.return_value = user
    
    with patch("star_itsm_api.services.user_admin._team_summaries_for_users") as mock_teams, \
         patch("star_itsm_api.services.user_admin.fetch_user_roles") as mock_roles, \
         patch("star_itsm_api.services.user_admin.attach_roles_to_user") as mock_attach:
        
        mock_teams.return_value = {}
        mock_roles.return_value = []
        
        result = await user_admin.get_user_admin(mock_db, user_id)
        assert result is not None
        assert result.organization_name is None
        assert result.roles == ["staff"]


@pytest.mark.asyncio
async def test_email_taken_detects_existing_user() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: uuid.uuid4()))
    taken = await user_admin.email_taken(mock_db, "Anna@Example.dk", exclude_user_id=None)
    assert taken is True


@pytest.mark.asyncio
async def test_email_taken_exclude_user() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: None))
    user_id = uuid.uuid4()
    taken = await user_admin.email_taken(mock_db, "Anna@Example.dk", exclude_user_id=user_id)
    assert taken is False


@pytest.mark.asyncio
async def test_sync_user_teams_rejects_unknown_team() -> None:
    team_id = uuid.uuid4()
    mock_db = AsyncMock()
    valid_result = MagicMock()
    valid_result.scalars.return_value.all.return_value = []
    mock_db.execute = AsyncMock(return_value=valid_result)

    with pytest.raises(ValueError, match="invalid_team"):
        await user_admin.sync_user_teams(mock_db, uuid.uuid4(), [team_id])


@pytest.mark.asyncio
async def test_sync_user_teams_success() -> None:
    mock_db = AsyncMock()
    user_id = uuid.uuid4()
    team_id = uuid.uuid4()
    
    # Mock valid team check
    valid_result = MagicMock()
    valid_result.scalars.return_value.all.return_value = [team_id]
    
    # Mock existing memberships
    existing_member = TeamMember(user_id=user_id, team_id=uuid.uuid4())
    existing_result = MagicMock()
    existing_result.scalars.return_value.all.return_value = [existing_member]
    
    mock_db.execute.side_effect = [valid_result, existing_result]
    
    await user_admin.sync_user_teams(mock_db, user_id, [team_id])
    
    mock_db.delete.assert_called_once_with(existing_member)
    assert mock_db.add.call_count == 1


@pytest.mark.asyncio
async def test_sync_user_teams_empty_team_ids() -> None:
    mock_db = AsyncMock()
    user_id = uuid.uuid4()
    
    # Mock existing memberships
    existing_member = TeamMember(user_id=user_id, team_id=uuid.uuid4())
    existing_result = MagicMock()
    existing_result.scalars.return_value.all.return_value = [existing_member]
    
    mock_db.execute.return_value = existing_result
    
    await user_admin.sync_user_teams(mock_db, user_id, [])
    
    mock_db.delete.assert_called_once_with(existing_member)
    assert mock_db.add.call_count == 0


@pytest.mark.asyncio
async def test_set_user_password_exempt() -> None:
    mock_db = AsyncMock()
    user = User(
        id=uuid.uuid4(),
        email="exempt@example.com",
        password_policy_exempt=True,
        must_change_password=False,
    )
    
    await user_admin.set_user_password(mock_db, user, "Short1!")
    assert user.password_hash is not None
    assert user.must_change_password is False
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_set_user_password_not_exempt() -> None:
    mock_db = AsyncMock()
    user = User(
        id=uuid.uuid4(),
        email="notexempt@example.com",
        password_policy_exempt=False,
        must_change_password=False,
    )
    
    await user_admin.set_user_password(mock_db, user, "Stardesk2026")
    assert user.password_hash is not None
    assert user.must_change_password is True
    mock_db.commit.assert_awaited_once()


def test_generate_temporary_password() -> None:
    pw = user_admin._generate_temporary_password(15)
    assert len(pw) == 15
    assert all(c in (user_admin.string.ascii_letters + user_admin.string.digits) for c in pw)


@pytest.mark.asyncio
async def test_create_user_admin_email_taken() -> None:
    mock_db = AsyncMock()
    with patch("star_itsm_api.services.user_admin.email_taken", return_value=True):
        with pytest.raises(ValueError, match="email_taken"):
            await user_admin.create_user_admin(
                mock_db,
                email="taken@example.com",
                display_name="Taken",
                role="staff",
                is_active=True,
                organization_id=None,
                team_ids=[],
                initial_password=None,
            )


@pytest.mark.asyncio
async def test_create_user_admin_success_with_password() -> None:
    mock_db = AsyncMock()
    
    with patch("star_itsm_api.services.user_admin.email_taken", return_value=False), \
         patch("star_itsm_api.services.user_admin.sync_user_roles", return_value="staff") as mock_sync_roles, \
         patch("star_itsm_api.services.user_admin.sync_user_teams") as mock_sync_teams, \
         patch("star_itsm_api.services.user_admin.get_user_admin") as mock_get_admin:
        
        mock_get_admin.return_value = MagicMock()
        
        created, generated = await user_admin.create_user_admin(
            mock_db,
            email="new@example.com",
            display_name="New User",
            role="staff",
            roles=["staff"],
            is_active=True,
            organization_id=None,
            team_ids=[],
            initial_password="Stardesk2026",
        )
        
        assert generated is None
        mock_db.flush.assert_awaited_once()
        mock_sync_roles.assert_awaited_once()
        mock_sync_teams.assert_awaited_once()
        mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_user_admin_success_generated_password() -> None:
    mock_db = AsyncMock()
    
    with patch("star_itsm_api.services.user_admin.email_taken", return_value=False), \
         patch("star_itsm_api.services.user_admin.sync_user_roles", return_value="staff"), \
         patch("star_itsm_api.services.user_admin.sync_user_teams"), \
         patch("star_itsm_api.services.user_admin.get_user_admin") as mock_get_admin:
        
        mock_get_admin.return_value = MagicMock()
        
        created, generated = await user_admin.create_user_admin(
            mock_db,
            email="new2@example.com",
            display_name="New User 2",
            role="staff",
            is_active=True,
            organization_id=None,
            team_ids=[],
            initial_password=None,
        )
        
        assert generated is not None
        assert len(generated) == 12
        mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_user_admin_roles_required() -> None:
    mock_db = AsyncMock()
    
    with patch("star_itsm_api.services.user_admin.email_taken", return_value=False), \
         patch("star_itsm_api.services.user_admin.sync_user_roles", side_effect=ValueError("roles_required")):
        
        with pytest.raises(ValueError, match="roles_required"):
            await user_admin.create_user_admin(
                mock_db,
                email="new@example.com",
                display_name="New User",
                role="staff",
                is_active=True,
                organization_id=None,
                team_ids=[],
                initial_password="Stardesk2026",
            )


@pytest.mark.asyncio
async def test_create_user_admin_invalid_team() -> None:
    mock_db = AsyncMock()
    
    with patch("star_itsm_api.services.user_admin.email_taken", return_value=False), \
         patch("star_itsm_api.services.user_admin.sync_user_roles", return_value="staff"), \
         patch("star_itsm_api.services.user_admin.sync_user_teams", side_effect=ValueError("invalid_team")):
        
        with pytest.raises(ValueError, match="invalid_team"):
            await user_admin.create_user_admin(
                mock_db,
                email="new@example.com",
                display_name="New User",
                role="staff",
                is_active=True,
                organization_id=None,
                team_ids=[uuid.uuid4()],
                initial_password="Stardesk2026",
            )


@pytest.mark.asyncio
async def test_create_user_admin_failed() -> None:
    mock_db = AsyncMock()
    
    with patch("star_itsm_api.services.user_admin.email_taken", return_value=False), \
         patch("star_itsm_api.services.user_admin.sync_user_roles", return_value="staff"), \
         patch("star_itsm_api.services.user_admin.sync_user_teams"), \
         patch("star_itsm_api.services.user_admin.get_user_admin", return_value=None):
        
        with pytest.raises(RuntimeError, match="user_create_failed"):
            await user_admin.create_user_admin(
                mock_db,
                email="new@example.com",
                display_name="New User",
                role="staff",
                is_active=True,
                organization_id=None,
                team_ids=[],
                initial_password="Stardesk2026",
            )
