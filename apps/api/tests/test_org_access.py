import uuid
from unittest.mock import AsyncMock, MagicMock, PropertyMock, patch

import pytest

from star_itsm_api.core.security import ROLE_ADMIN, ROLE_AGENT, ROLE_SUBMITTER, ROLE_TOP_ADMIN
from star_itsm_api.services.org_access import (
    IntegrationOrganizationError,
    apply_agent_team_list_filter,
    apply_ticket_list_filter,
    can_assign_to_any_team,
    is_sf_virksomhed_agent,
    resolve_integration_organization_id,
    user_can_access_ticket,
)
from star_itsm_api.services.permissions import is_admin


def test_sf_virksomhed_agent_detected() -> None:
    user = MagicMock()
    user.role = ROLE_AGENT
    user.organization_id = uuid.uuid4()
    assert is_sf_virksomhed_agent(user) is True
    assert can_assign_to_any_team(user) is True


def test_sf_admin_can_assign_any_team() -> None:
    user = MagicMock()
    user.role = ROLE_ADMIN
    user.organization_id = None
    assert can_assign_to_any_team(user) is True
    assert is_sf_virksomhed_agent(user) is False
    assert is_admin(user) is True


def test_top_admin_can_assign_any_team() -> None:
    user = MagicMock()
    user.role = ROLE_TOP_ADMIN
    user.organization_id = None
    assert can_assign_to_any_team(user) is True
    assert is_admin(user) is True


@pytest.mark.asyncio
async def test_resolve_integration_org_id_direct() -> None:
    user = MagicMock()
    org_id = uuid.uuid4()
    user.organization_id = org_id
    db = AsyncMock()
    resolved = await resolve_integration_organization_id(db, user)
    assert resolved == org_id


@pytest.mark.asyncio
async def test_resolve_integration_org_id_not_admin_raises() -> None:
    user = MagicMock()
    user.organization_id = None
    user.role = ROLE_SUBMITTER  # not admin
    db = AsyncMock()
    with pytest.raises(IntegrationOrganizationError) as exc:
        await resolve_integration_organization_id(db, user)
    assert "Bruger er ikke knyttet til en organisation" in str(exc.value)


@pytest.mark.asyncio
async def test_resolve_integration_org_id_admin_with_default_org() -> None:
    user = MagicMock()
    user.organization_id = None
    user.role = ROLE_ADMIN  # is admin
    db = AsyncMock()

    # First execute call: list of default orgs
    default_org_id = uuid.uuid4()
    mock_result_default = MagicMock()
    mock_result_default.all.return_value = [(default_org_id, "SF Operations")]

    db.execute = AsyncMock(return_value=mock_result_default)

    resolved = await resolve_integration_organization_id(db, user)
    assert resolved == default_org_id


@pytest.mark.asyncio
async def test_resolve_integration_org_id_admin_fallback_to_any_org() -> None:
    user = MagicMock()
    user.organization_id = None
    user.role = ROLE_ADMIN
    db = AsyncMock()

    # First execute: empty default orgs list
    mock_result_default = MagicMock()
    mock_result_default.all.return_value = []

    # Second execute: fallback org
    fallback_org_id = uuid.uuid4()
    mock_result_fallback = MagicMock()
    mock_result_fallback.scalar_one_or_none.return_value = fallback_org_id

    db.execute = AsyncMock(side_effect=[mock_result_default, mock_result_fallback])

    resolved = await resolve_integration_organization_id(db, user)
    assert resolved == fallback_org_id


@pytest.mark.asyncio
async def test_resolve_integration_org_id_admin_no_orgs_raises() -> None:
    user = MagicMock()
    user.organization_id = None
    user.role = ROLE_ADMIN
    db = AsyncMock()

    mock_result_default = MagicMock()
    mock_result_default.all.return_value = []

    mock_result_fallback = MagicMock()
    mock_result_fallback.scalar_one_or_none.return_value = None

    db.execute = AsyncMock(side_effect=[mock_result_default, mock_result_fallback])

    with pytest.raises(IntegrationOrganizationError) as exc:
        await resolve_integration_organization_id(db, user)
    assert "Ingen aktiv organisation fundet" in str(exc.value)


def test_apply_ticket_list_filter_full_visibility() -> None:
    user = MagicMock()
    user.role = ROLE_ADMIN  # admin has full visibility
    stmt = MagicMock()
    assert apply_ticket_list_filter(stmt, user) == stmt


def test_apply_ticket_list_filter_agent_with_org() -> None:
    user = MagicMock()
    user.role = ROLE_AGENT
    org_id = uuid.uuid4()
    user.organization_id = org_id
    stmt = MagicMock()
    stmt.where = MagicMock(return_value="filtered_stmt")
    assert apply_ticket_list_filter(stmt, user) == "filtered_stmt"
    stmt.where.assert_called_once()


def test_apply_ticket_list_filter_submitter_store_sager_with_org() -> None:
    user = MagicMock()
    user.role = ROLE_SUBMITTER
    org_id = uuid.uuid4()
    user.organization_id = org_id
    stmt = MagicMock()
    stmt.where = MagicMock(return_value="filtered_stmt")
    assert apply_ticket_list_filter(stmt, user, store_sager=True) == "filtered_stmt"
    stmt.where.assert_called_once()


def test_apply_ticket_list_filter_submitter_store_sager_without_org() -> None:
    user = MagicMock()
    user.role = ROLE_SUBMITTER
    user.organization_id = None
    stmt = MagicMock()
    stmt.where = MagicMock(return_value="filtered_stmt")
    assert apply_ticket_list_filter(stmt, user, store_sager=True) == "filtered_stmt"
    stmt.where.assert_called_once()


def test_apply_ticket_list_filter_submitter_no_store_sager() -> None:
    user = MagicMock()
    user.role = ROLE_SUBMITTER
    org_id = uuid.uuid4()
    user.organization_id = org_id
    stmt = MagicMock()
    stmt.where = MagicMock(return_value="filtered_stmt")
    assert apply_ticket_list_filter(stmt, user, store_sager=False) == "filtered_stmt"
    stmt.where.assert_called_once()


def test_apply_ticket_list_filter_submitter_no_store_sager_no_org() -> None:
    user = MagicMock()
    user.role = ROLE_SUBMITTER
    user.organization_id = None
    stmt = MagicMock()
    stmt.where = MagicMock(return_value="filtered_stmt")
    assert apply_ticket_list_filter(stmt, user, store_sager=False) == "filtered_stmt"
    stmt.where.assert_called_once()


def test_apply_ticket_list_filter_other_role() -> None:
    user = MagicMock()
    user.role = "other"
    user.organization_id = None
    stmt = MagicMock()
    assert apply_ticket_list_filter(stmt, user) == stmt


@pytest.mark.asyncio
async def test_apply_agent_team_list_filter_with_teams() -> None:
    user = MagicMock()
    user.id = uuid.uuid4()
    stmt = MagicMock()
    stmt.where = MagicMock(return_value="filtered_stmt")
    db = AsyncMock()

    with patch("star_itsm_api.services.org_access.get_user_team_ids", new_callable=AsyncMock) as mock_get_teams:
        mock_get_teams.return_value = [uuid.uuid4(), uuid.uuid4()]
        res = await apply_agent_team_list_filter(db, stmt, user)
        assert res == "filtered_stmt"
        mock_get_teams.assert_called_once_with(db, user.id)
        stmt.where.assert_called_once()


@pytest.mark.asyncio
async def test_apply_agent_team_list_filter_without_teams() -> None:
    user = MagicMock()
    user.id = uuid.uuid4()
    stmt = MagicMock()
    stmt.where = MagicMock(return_value="filtered_stmt")
    db = AsyncMock()

    with patch("star_itsm_api.services.org_access.get_user_team_ids", new_callable=AsyncMock) as mock_get_teams:
        mock_get_teams.return_value = []
        res = await apply_agent_team_list_filter(db, stmt, user)
        assert res == "filtered_stmt"
        mock_get_teams.assert_called_once_with(db, user.id)
        stmt.where.assert_called_once()


@pytest.mark.asyncio
async def test_user_can_access_ticket_full_visibility() -> None:
    user = MagicMock()
    user.role = ROLE_ADMIN  # has full visibility
    ticket = MagicMock()
    db = AsyncMock()
    assert await user_can_access_ticket(db, user, ticket) is True


@pytest.mark.asyncio
async def test_user_can_access_ticket_same_org() -> None:
    user = MagicMock()
    user.role = ROLE_SUBMITTER
    org_id = uuid.uuid4()
    user.organization_id = org_id
    ticket = MagicMock()
    ticket.organization_id = org_id
    db = AsyncMock()
    assert await user_can_access_ticket(db, user, ticket) is True


@pytest.mark.asyncio
async def test_user_can_access_ticket_shared() -> None:
    user = MagicMock()
    user.role = ROLE_SUBMITTER
    user.organization_id = uuid.uuid4()
    ticket = MagicMock()
    ticket.organization_id = uuid.uuid4()  # different
    ticket.is_shared = True
    db = AsyncMock()
    assert await user_can_access_ticket(db, user, ticket) is True


@pytest.mark.asyncio
async def test_user_can_access_ticket_submitter_reporter() -> None:
    user = MagicMock()
    user.role = ROLE_SUBMITTER
    user.id = uuid.uuid4()
    user.organization_id = None
    ticket = MagicMock()
    ticket.organization_id = None
    ticket.is_shared = False
    ticket.reporter_user_id = user.id
    db = AsyncMock()
    assert await user_can_access_ticket(db, user, ticket) is True


@pytest.mark.asyncio
async def test_user_can_access_ticket_submitter_major_org() -> None:
    user = MagicMock()
    user.role = ROLE_SUBMITTER
    user.id = uuid.uuid4()
    org_id = uuid.uuid4()
    user.organization_id = org_id
    ticket = MagicMock()
    ticket.organization_id = org_id
    ticket.is_shared = False
    ticket.is_major = True
    ticket.reporter_user_id = uuid.uuid4()
    db = AsyncMock()
    assert await user_can_access_ticket(db, user, ticket) is True


@pytest.mark.asyncio
async def test_user_can_access_ticket_submitter_major_org_unreachable_branch() -> None:
    # Forces coverage on lines 151-152 of org_access.py
    # by making the first check on organization_id evaluate to False (different org)
    # and the second check evaluate to True (same org).
    user = MagicMock()
    user.role = ROLE_SUBMITTER
    user.id = uuid.uuid4()
    org_id = uuid.uuid4()
    user.organization_id = org_id

    ticket = MagicMock()
    type(ticket).organization_id = PropertyMock(side_effect=[uuid.uuid4(), org_id])
    ticket.is_shared = False
    ticket.is_major = True
    ticket.reporter_user_id = uuid.uuid4()
    db = AsyncMock()
    assert await user_can_access_ticket(db, user, ticket) is True


@pytest.mark.asyncio
async def test_user_can_access_ticket_submitter_major_shared_unreachable_branch() -> None:
    # Forces coverage on lines 153-154 of org_access.py
    # by making the first check on is_shared evaluate to False
    # and the second check evaluate to True.
    user = MagicMock()
    user.role = ROLE_SUBMITTER
    user.id = uuid.uuid4()
    user.organization_id = None

    ticket = MagicMock()
    ticket.organization_id = uuid.uuid4()
    type(ticket).is_shared = PropertyMock(side_effect=[False, True])
    ticket.is_major = True
    ticket.reporter_user_id = uuid.uuid4()
    db = AsyncMock()
    assert await user_can_access_ticket(db, user, ticket) is True


@pytest.mark.asyncio
async def test_user_can_access_ticket_submitter_major_shared() -> None:
    user = MagicMock()
    user.role = ROLE_SUBMITTER
    user.id = uuid.uuid4()
    user.organization_id = None
    ticket = MagicMock()
    ticket.organization_id = uuid.uuid4()
    ticket.is_shared = True
    ticket.is_major = True
    ticket.reporter_user_id = uuid.uuid4()
    db = AsyncMock()
    assert await user_can_access_ticket(db, user, ticket) is True


@pytest.mark.asyncio
async def test_user_can_access_ticket_submitter_denied() -> None:
    user = MagicMock()
    user.role = ROLE_SUBMITTER
    user.id = uuid.uuid4()
    user.organization_id = None
    ticket = MagicMock()
    ticket.organization_id = uuid.uuid4()
    ticket.is_shared = False
    ticket.is_major = False
    ticket.reporter_user_id = uuid.uuid4()
    db = AsyncMock()
    assert await user_can_access_ticket(db, user, ticket) is False


@pytest.mark.asyncio
async def test_user_can_access_ticket_agent_no_org() -> None:
    user = MagicMock()
    user.role = ROLE_AGENT
    user.organization_id = None
    ticket = MagicMock()
    ticket.organization_id = uuid.uuid4()
    ticket.is_shared = False
    db = AsyncMock()
    assert await user_can_access_ticket(db, user, ticket) is True


@pytest.mark.asyncio
async def test_user_can_access_ticket_agent_reporter() -> None:
    user = MagicMock()
    user.role = ROLE_AGENT
    user.id = uuid.uuid4()
    user.organization_id = uuid.uuid4()
    ticket = MagicMock()
    ticket.organization_id = uuid.uuid4()  # different, but reporter match
    ticket.is_shared = False
    ticket.reporter_user_id = user.id
    db = AsyncMock()
    assert await user_can_access_ticket(db, user, ticket) is True


@pytest.mark.asyncio
async def test_user_can_access_ticket_agent_assignee() -> None:
    user = MagicMock()
    user.role = ROLE_AGENT
    user.id = uuid.uuid4()
    user.organization_id = uuid.uuid4()
    ticket = MagicMock()
    ticket.organization_id = uuid.uuid4()
    ticket.is_shared = False
    ticket.reporter_user_id = uuid.uuid4()
    ticket.assigned_user_id = user.id
    db = AsyncMock()
    assert await user_can_access_ticket(db, user, ticket) is True


@pytest.mark.asyncio
async def test_user_can_access_ticket_agent_team_assigned() -> None:
    user = MagicMock()
    user.role = ROLE_AGENT
    user.id = uuid.uuid4()
    user.organization_id = uuid.uuid4()
    ticket = MagicMock()
    ticket.organization_id = uuid.uuid4()
    ticket.is_shared = False
    ticket.reporter_user_id = uuid.uuid4()
    ticket.assigned_user_id = uuid.uuid4()
    team_id = uuid.uuid4()
    ticket.assigned_team_id = team_id
    db = AsyncMock()

    with patch("star_itsm_api.services.org_access.get_user_team_ids", new_callable=AsyncMock) as mock_get_teams:
        mock_get_teams.return_value = [team_id]
        assert await user_can_access_ticket(db, user, ticket) is True
        mock_get_teams.assert_called_once_with(db, user.id)


@pytest.mark.asyncio
async def test_user_can_access_ticket_agent_denied() -> None:
    user = MagicMock()
    user.role = ROLE_AGENT
    user.id = uuid.uuid4()
    user.organization_id = uuid.uuid4()
    ticket = MagicMock()
    ticket.organization_id = uuid.uuid4()
    ticket.is_shared = False
    ticket.reporter_user_id = uuid.uuid4()
    ticket.assigned_user_id = uuid.uuid4()
    ticket.assigned_team_id = uuid.uuid4()
    db = AsyncMock()

    with patch("star_itsm_api.services.org_access.get_user_team_ids", new_callable=AsyncMock) as mock_get_teams:
        mock_get_teams.return_value = [uuid.uuid4()]
        assert await user_can_access_ticket(db, user, ticket) is False
