import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from star_itsm_api.schemas.user_admin import OrganizationOption
from star_itsm_api.services import user_admin


def test_build_admin_meta_includes_assignable_roles() -> None:
    orgs = [OrganizationOption(id=uuid.uuid4(), name="STAR")]
    meta = user_admin.build_admin_meta(orgs)
    assert meta.organizations == orgs
    assert len(meta.roles) >= 1
    assert all(role.label for role in meta.roles)


@pytest.mark.asyncio
async def test_team_summaries_for_users_empty() -> None:
    mock_db = AsyncMock()
    result = await user_admin._team_summaries_for_users(mock_db, [])
    assert result == {}
    mock_db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_email_taken_detects_existing_user() -> None:
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: uuid.uuid4()))
    taken = await user_admin.email_taken(mock_db, "Anna@Example.dk", exclude_user_id=None)
    assert taken is True


@pytest.mark.asyncio
async def test_sync_user_teams_rejects_unknown_team() -> None:
    team_id = uuid.uuid4()
    mock_db = AsyncMock()
    valid_result = MagicMock()
    valid_result.scalars.return_value.all.return_value = []
    mock_db.execute = AsyncMock(return_value=valid_result)

    with pytest.raises(ValueError, match="invalid_team"):
        await user_admin.sync_user_teams(mock_db, uuid.uuid4(), [team_id])
