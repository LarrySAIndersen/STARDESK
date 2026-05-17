import uuid

from sqlalchemy import Select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import ROLE_ADMIN, ROLE_AGENT, ROLE_SUBMITTER
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.user import User
from star_itsm_api.services.teams import get_user_team_ids


def get_user_organization_id(user: User) -> uuid.UUID | None:
    return getattr(user, "organization_id", None)


def apply_ticket_list_filter(stmt: Select[tuple[Ticket]], user: User) -> Select[tuple[Ticket]]:
    if user.role == ROLE_ADMIN:
        return stmt
    org_id = get_user_organization_id(user)
    if org_id is not None:
        return stmt.where(Ticket.organization_id == org_id)
    if user.role == ROLE_SUBMITTER:
        return stmt.where(Ticket.reporter_user_id == user.id)
    return stmt


async def apply_agent_team_list_filter(
    db: AsyncSession,
    stmt: Select[tuple[Ticket]],
    user: User,
) -> Select[tuple[Ticket]]:
    team_ids = await get_user_team_ids(db, user.id)
    if team_ids:
        return stmt.where(
            or_(
                Ticket.assigned_team_id.in_(team_ids),
                Ticket.assigned_user_id == user.id,
            )
        )
    return stmt.where(Ticket.assigned_user_id == user.id)


async def user_can_access_ticket(db: AsyncSession, user: User, ticket: Ticket) -> bool:
    if user.role == ROLE_ADMIN:
        return True
    org_id = get_user_organization_id(user)
    if org_id is not None and ticket.organization_id == org_id:
        return True
    if user.role == ROLE_SUBMITTER and ticket.reporter_user_id == user.id:
        return True
    if user.role == ROLE_AGENT:
        if ticket.reporter_user_id == user.id or ticket.assigned_user_id == user.id:
            return True
        team_ids = await get_user_team_ids(db, user.id)
        if ticket.assigned_team_id and ticket.assigned_team_id in team_ids:
            return True
    return False
