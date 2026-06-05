"""Unit tests for star_itsm_api.services.teams (service-level, mocked DB)."""

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from star_itsm_api.models.team_member import TeamMember
from star_itsm_api.services import teams


@pytest.mark.asyncio
async def test_get_user_team_ids() -> None:
    db = AsyncMock()
    ids = [uuid.uuid4(), uuid.uuid4()]
    res = MagicMock()
    res.scalars.return_value.all.return_value = ids
    db.execute = AsyncMock(return_value=res)
    out = await teams.get_user_team_ids(db, uuid.uuid4())
    assert out == ids


@pytest.mark.asyncio
async def test_user_in_team_true() -> None:
    db = AsyncMock()
    res = MagicMock()
    res.scalar_one_or_none.return_value = uuid.uuid4()
    db.execute = AsyncMock(return_value=res)
    assert await teams.user_in_team(db, uuid.uuid4(), uuid.uuid4()) is True


@pytest.mark.asyncio
async def test_user_in_team_false() -> None:
    db = AsyncMock()
    res = MagicMock()
    res.scalar_one_or_none.return_value = None
    db.execute = AsyncMock(return_value=res)
    assert await teams.user_in_team(db, uuid.uuid4(), uuid.uuid4()) is False


@pytest.mark.asyncio
async def test_build_team_read_with_members() -> None:
    db = AsyncMock()
    user = SimpleNamespace(
        id=uuid.uuid4(),
        display_name="Åse Ørsted",
        email="aase@example.dk",
        role="agent",
    )
    membership = SimpleNamespace(joined_at=datetime.now(UTC))
    res = MagicMock()
    res.all.return_value = [(membership, user)]
    db.execute = AsyncMock(return_value=res)
    team = SimpleNamespace(
        id=uuid.uuid4(),
        name="Drift",
        description="Beskrivelse på dansk",
        is_active=True,
    )
    out = await teams.build_team_read(db, team)  # type: ignore[arg-type]
    assert out.name == "Drift"
    assert out.description == "Beskrivelse på dansk"
    assert len(out.members) == 1
    assert out.members[0].display_name == "Åse Ørsted"
    assert out.members[0].role == "agent"
    assert out.members[0].role_label


@pytest.mark.asyncio
async def test_sync_team_members_empty_clears_only() -> None:
    db = AsyncMock()
    db.execute = AsyncMock()
    added: list[object] = []
    db.add = lambda obj: added.append(obj)
    await teams.sync_team_members(db, uuid.uuid4(), [])
    db.execute.assert_awaited_once()
    assert added == []


@pytest.mark.asyncio
async def test_sync_team_members_valid_adds_rows() -> None:
    db = AsyncMock()
    uid1, uid2 = uuid.uuid4(), uuid.uuid4()
    valid_res = MagicMock()
    valid_res.scalars.return_value.all.return_value = [uid1, uid2]
    db.execute = AsyncMock(side_effect=[valid_res, MagicMock()])
    added: list[object] = []
    db.add = lambda obj: added.append(obj)
    await teams.sync_team_members(db, uuid.uuid4(), [uid1, uid2])
    assert len(added) == 2
    assert all(isinstance(m, TeamMember) for m in added)


@pytest.mark.asyncio
async def test_sync_team_members_invalid_raises() -> None:
    db = AsyncMock()
    valid_res = MagicMock()
    valid_res.scalars.return_value.all.return_value = []
    db.execute = AsyncMock(return_value=valid_res)
    db.add = MagicMock()
    with pytest.raises(ValueError, match="invalid_user"):
        await teams.sync_team_members(db, uuid.uuid4(), [uuid.uuid4()])
    db.add.assert_not_called()
