"""Assignment invariants: group↔ticket relation must stay consistent in DB."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from star_itsm_api.services.ticket_assignment import resolve_ticket_assignment


@pytest.mark.asyncio
async def test_user_without_team_requires_group_when_multiple_memberships() -> None:
    db = AsyncMock()
    user_id = uuid.uuid4()
    with (
        patch(
            "star_itsm_api.services.ticket_assignment.get_user_team_ids",
            new_callable=AsyncMock,
            return_value=[uuid.uuid4(), uuid.uuid4()],
        ),
        pytest.raises(HTTPException) as exc,
    ):
        await resolve_ticket_assignment(
            db,
            current_team_id=None,
            current_user_id=None,
            updates={"assigned_user_id": user_id},
        )

    assert exc.value.status_code == 400
    assert "Gruppe" in exc.value.detail


@pytest.mark.asyncio
async def test_user_without_team_auto_picks_single_membership() -> None:
    db = AsyncMock()
    user_id = uuid.uuid4()
    only_team = uuid.uuid4()
    with patch(
        "star_itsm_api.services.ticket_assignment.get_user_team_ids",
        new_callable=AsyncMock,
        return_value=[only_team],
    ):
        team_id, resolved_user = await resolve_ticket_assignment(
            db,
            current_team_id=None,
            current_user_id=None,
            updates={"assigned_user_id": user_id},
        )

    assert team_id == only_team
    assert resolved_user == user_id


@pytest.mark.asyncio
async def test_clearing_team_clears_user() -> None:
    db = AsyncMock()
    team_id, user_id = await resolve_ticket_assignment(
        db,
        current_team_id=uuid.uuid4(),
        current_user_id=uuid.uuid4(),
        updates={"assigned_team_id": None},
    )

    assert team_id is None
    assert user_id is None
