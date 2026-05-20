import uuid

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.services.teams import get_user_team_ids


async def resolve_ticket_assignment(
    db: AsyncSession,
    *,
    current_team_id: uuid.UUID | None,
    current_user_id: uuid.UUID | None,
    updates: dict,
) -> tuple[uuid.UUID | None, uuid.UUID | None]:
    """
    Enforce DB invariants for ticket↔group↔person:
    - Clearing group clears person.
    - Person assignment always requires a group (auto-pick if user has exactly one).
    """
    team_id = current_team_id
    user_id = current_user_id
    if "assigned_team_id" in updates:
        team_id = updates["assigned_team_id"]
    if "assigned_user_id" in updates:
        user_id = updates["assigned_user_id"]

    if "assigned_team_id" in updates and team_id is None:
        user_id = None

    if user_id is not None and team_id is None:
        user_team_ids = await get_user_team_ids(db, user_id)
        if len(user_team_ids) == 1:
            team_id = user_team_ids[0]
        else:
            raise HTTPException(
                status_code=400,
                detail="Gruppe er påkrævet når sagen tildeles en person",
            )

    return team_id, user_id
