from types import SimpleNamespace

import pytest

from star_itsm_api.core.security import ROLE_ADMIN, ROLE_TOP_ADMIN
from star_itsm_api.core.top_admin_policy import (
    assert_may_assign_role,
    can_hold_top_admin_role,
    role_after_top_admin_policy,
)


def test_only_larrysanders_may_hold_top_admin() -> None:
    assert can_hold_top_admin_role("larrysanders@example.dk")
    assert not can_hold_top_admin_role("sf01@example.dk")


def test_role_after_policy_demotes_non_owner() -> None:
    assert role_after_top_admin_policy("sf01@example.dk", ROLE_TOP_ADMIN) == ROLE_ADMIN


def test_assert_may_assign_reserved() -> None:
    actor = SimpleNamespace(role=ROLE_TOP_ADMIN, email="larrysanders@example.dk")
    with pytest.raises(ValueError, match="top_admin_reserved"):
        assert_may_assign_role(actor=actor, target_email="sf01@example.dk", new_role=ROLE_TOP_ADMIN)
