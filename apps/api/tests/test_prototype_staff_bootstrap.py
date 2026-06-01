import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from tests.support.users import make_test_user
from tests.prototype_test_credentials import PLACEHOLDER_HASH

from star_itsm_api.core.security import ROLE_ADMIN, ROLE_SUBMITTER, ROLE_SUPPORTER
from star_itsm_api.services.prototype_staff_bootstrap import ensure_prototype_staff_account


@pytest.mark.asyncio
async def test_ensure_prototype_staff_account_upgrades_larrysanders2() -> None:
    user = make_test_user(
        user_id=uuid.uuid4(),
        email="larrysanders2@example.dk",
        display_name="Larrysanders2",
        role=ROLE_SUBMITTER,
        ui_mode=None,
        password_hash=PLACEHOLDER_HASH,
        must_change_password=True,
    )
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=lambda: uuid.uuid4()),
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=lambda: []))),
        ]
    )
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    with pytest.MonkeyPatch.context() as patch:
        patch.setattr(
            "star_itsm_api.services.prototype_staff_bootstrap.sync_user_teams",
            AsyncMock(),
        )
        changed = await ensure_prototype_staff_account(db, user)

    assert changed is True
    assert user.role == ROLE_SUPPORTER
    assert user.ui_mode == "classic"
    assert user.must_change_password is False
    assert user.password_policy_exempt is True
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_ensure_prototype_staff_account_clears_larrysanders_must_change() -> None:
    user = make_test_user(
        user_id=uuid.uuid4(),
        email="larrysanders@example.dk",
        display_name="Larry",
        role=ROLE_SUBMITTER,
        ui_mode=None,
        password_hash=PLACEHOLDER_HASH,
        must_change_password=True,
    )
    db = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    changed = await ensure_prototype_staff_account(db, user)

    assert changed is True
    assert user.role == ROLE_ADMIN
    assert user.must_change_password is False
    assert user.password_policy_exempt is True
    db.commit.assert_awaited()
