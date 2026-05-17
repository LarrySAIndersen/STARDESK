import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from star_itsm_api.core.security import ROLE_ADMIN, ROLE_AGENT, ROLE_SUBMITTER, ROLE_TOP_ADMIN
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
