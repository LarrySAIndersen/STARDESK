import uuid
from unittest.mock import MagicMock

from star_itsm_api.core.security import ROLE_ADMIN, ROLE_AGENT, ROLE_TOP_ADMIN
from star_itsm_api.services.org_access import (
    can_assign_to_any_team,
    is_sf_virksomhed_agent,
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
