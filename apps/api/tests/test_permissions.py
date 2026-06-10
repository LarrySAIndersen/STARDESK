import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from star_itsm_api.core.security import (
    ROLE_ADMIN,
    ROLE_AGENT,
    ROLE_SUBMITTER,
    ROLE_SUPPORTER,
    ROLE_TOP_ADMIN,
)
from star_itsm_api.services.org_access import user_can_access_ticket
from star_itsm_api.services.permissions import (
    can_export_tickets,
    can_manage_users,
    has_full_ticket_visibility,
    is_admin,
    is_staff_role,
)


def _ticket(**kwargs: object) -> SimpleNamespace:
    defaults = {
        "organization_id": uuid.uuid4(),
        "reporter_user_id": uuid.uuid4(),
        "assigned_user_id": None,
        "assigned_team_id": None,
        "is_major": False,
        "is_shared": False,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_top_admin_has_full_visibility() -> None:
    user = MagicMock(role=ROLE_TOP_ADMIN, organization_id=None)
    assert has_full_ticket_visibility(user)
    assert is_admin(user)
    assert can_manage_users(user)
    assert can_export_tickets(user)
    assert is_staff_role(user)


def test_admin_same_ticket_access_as_top_admin() -> None:
    user = MagicMock(role=ROLE_ADMIN, organization_id=None)
    assert has_full_ticket_visibility(user)
    assert is_admin(user)


def test_supporter_has_ticket_visibility_not_user_management() -> None:
    user = MagicMock(role=ROLE_SUPPORTER, organization_id=None)
    assert has_full_ticket_visibility(user)
    assert is_admin(user)
    assert not can_manage_users(user)
    assert can_export_tickets(user)
    assert is_staff_role(user)


def test_end_user_cannot_export() -> None:
    user = MagicMock(role=ROLE_SUBMITTER)
    assert not can_export_tickets(user)
    assert not is_staff_role(user)


@pytest.mark.asyncio
async def test_end_user_sees_shared_ticket_from_other_org() -> None:
    org_a = uuid.uuid4()
    org_b = uuid.uuid4()
    user = MagicMock(role=ROLE_SUBMITTER, organization_id=org_a, id=uuid.uuid4())
    ticket = _ticket(organization_id=org_b, is_shared=True, reporter_user_id=uuid.uuid4())
    assert await user_can_access_ticket(MagicMock(), user, ticket) is True


@pytest.mark.asyncio
async def test_end_user_sees_own_org_ticket() -> None:
    org_id = uuid.uuid4()
    user = MagicMock(role=ROLE_SUBMITTER, organization_id=org_id, id=uuid.uuid4())
    ticket = _ticket(organization_id=org_id, reporter_user_id=uuid.uuid4())
    assert await user_can_access_ticket(MagicMock(), user, ticket) is True


@pytest.mark.asyncio
async def test_end_user_denied_other_org_private_ticket() -> None:
    user = MagicMock(
        role=ROLE_SUBMITTER,
        organization_id=uuid.uuid4(),
        id=uuid.uuid4(),
    )
    ticket = _ticket(
        organization_id=uuid.uuid4(),
        reporter_user_id=uuid.uuid4(),
        is_shared=False,
    )
    assert await user_can_access_ticket(MagicMock(), user, ticket) is False


def test_agent_can_export() -> None:
    user = MagicMock(role=ROLE_AGENT)
    assert can_export_tickets(user)


def test_is_top_admin() -> None:
    from star_itsm_api.services.permissions import is_top_admin
    user_top = MagicMock(role=ROLE_TOP_ADMIN)
    user_agent = MagicMock(role=ROLE_AGENT)
    assert is_top_admin(user_top) is True
    assert is_top_admin(user_agent) is False


def test_is_end_user() -> None:
    from star_itsm_api.services.permissions import is_end_user
    user_end = MagicMock(role=ROLE_SUBMITTER)
    user_agent = MagicMock(role=ROLE_AGENT)
    
    # User with both ROLE_SUBMITTER and ROLE_AGENT (not a pure end user)
    user_both = MagicMock(role=ROLE_SUBMITTER, _roles_cache=frozenset({ROLE_SUBMITTER, ROLE_AGENT}))
    
    assert is_end_user(user_end) is True
    assert is_end_user(user_agent) is False
    assert is_end_user(user_both) is False


def test_is_stardesk_reviewer() -> None:
    from star_itsm_api.core.security import ROLE_STARDESK_REVIEWER
    from star_itsm_api.services.permissions import is_stardesk_reviewer
    user_rev = MagicMock(role=ROLE_STARDESK_REVIEWER)
    user_agent = MagicMock(role=ROLE_AGENT)
    assert is_stardesk_reviewer(user_rev) is True
    assert is_stardesk_reviewer(user_agent) is False


def test_can_access_kundeportal_2() -> None:
    from star_itsm_api.core.security import ROLE_AGENT, ROLE_KUNDEPORTAL_2
    from star_itsm_api.services.permissions import can_access_kundeportal_2

    kp2_user = MagicMock(role=ROLE_KUNDEPORTAL_2, _roles_cache=frozenset({ROLE_KUNDEPORTAL_2}))
    agent = MagicMock(role=ROLE_AGENT, _roles_cache=frozenset({ROLE_AGENT}))

    assert can_access_kundeportal_2(kp2_user) is True
    assert can_access_kundeportal_2(agent) is True


def test_can_assign_tickets() -> None:
    from star_itsm_api.services.permissions import can_assign_tickets
    for role in [ROLE_TOP_ADMIN, ROLE_ADMIN, ROLE_AGENT, ROLE_SUPPORTER]:
        user = MagicMock(role=role)
        assert can_assign_tickets(user) is True
    user_end = MagicMock(role=ROLE_SUBMITTER)
    assert can_assign_tickets(user_end) is False


def test_roles_tuples() -> None:
    from star_itsm_api.services.permissions import admin_roles_tuple, staff_roles_tuple
    staff = staff_roles_tuple()
    admin = admin_roles_tuple()
    assert isinstance(staff, tuple)
    assert isinstance(admin, tuple)
    assert ROLE_ADMIN in admin
    assert ROLE_AGENT in staff

