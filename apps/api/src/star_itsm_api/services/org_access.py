import uuid

from sqlalchemy import Select, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import ROLE_AGENT, ROLE_SUBMITTER
from star_itsm_api.models.organization import Organization
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.user import User
from star_itsm_api.services.permissions import has_full_ticket_visibility, is_admin
from star_itsm_api.services.teams import get_user_team_ids

# Preferred org for SF central admins (organization_id NULL) when scoping integrations.
INTEGRATION_DEFAULT_ORG_NAMES: tuple[str, ...] = (
    "SF Operations",
    "Virksomhed",
)


class IntegrationOrganizationError(Exception):
    """Org could not be resolved for org-scoped integration APIs."""


def get_user_organization_id(user: User) -> uuid.UUID | None:
    return getattr(user, "organization_id", None)


async def resolve_integration_organization_id(
    db: AsyncSession,
    user: User,
) -> uuid.UUID:
    """Resolve org for Slack/Gmail integration endpoints.

    Virksomheds-agents use their organization_id. SF admins without an org use the
    first matching default org (typically SF Operations).
    """
    org_id = get_user_organization_id(user)
    if org_id is not None:
        return org_id

    if not is_admin(user):
        raise IntegrationOrganizationError(
            "Bruger er ikke knyttet til en organisation. Kontakt en administrator."
        )

    default_orgs = await db.execute(
        select(Organization.id, Organization.name).where(
            Organization.name.in_(INTEGRATION_DEFAULT_ORG_NAMES),
            Organization.is_active.is_(True),
        )
    )
    by_name = {name: org_id for org_id, name in default_orgs.all()}
    for name in INTEGRATION_DEFAULT_ORG_NAMES:
        found = by_name.get(name)
        if found is not None:
            return found

    row = await db.execute(
        select(Organization.id)
        .where(Organization.is_active.is_(True))
        .order_by(Organization.name.asc())
        .limit(1)
    )
    found = row.scalar_one_or_none()
    if found is None:
        raise IntegrationOrganizationError(
            "Ingen aktiv organisation fundet. Opret mindst én organisation før integration."
        )
    return found


def is_sf_virksomhed_agent(user: User) -> bool:
    """Agent tied to one indmelder-organisation (not SF central admin)."""
    return user.role == ROLE_AGENT and get_user_organization_id(user) is not None


def can_assign_to_any_team(user: User) -> bool:
    """SF admins and virksomhed agents may forward tickets to any group."""
    return is_admin(user) or is_sf_virksomhed_agent(user)


def _end_user_list_visibility(user: User):
    """Slutbruger: own organisation, delte sager, and own reporter tickets without org."""
    org_id = get_user_organization_id(user)
    clauses = [Ticket.is_shared.is_(True)]
    if org_id is not None:
        clauses.append(Ticket.organization_id == org_id)
    clauses.append(Ticket.reporter_user_id == user.id)
    return or_(*clauses)


def apply_ticket_list_filter(
    stmt: Select[tuple[Ticket]],
    user: User,
    *,
    store_sager: bool = False,
) -> Select[tuple[Ticket]]:
    if has_full_ticket_visibility(user):
        return stmt
    org_id = get_user_organization_id(user)
    if org_id is not None and user.role == ROLE_AGENT:
        return stmt.where(Ticket.organization_id == org_id)
    if user.role == ROLE_SUBMITTER:
        if store_sager:
            org_id = get_user_organization_id(user)
            if org_id is not None:
                return stmt.where(
                    Ticket.is_major.is_(True),
                    or_(
                        Ticket.organization_id == org_id,
                        Ticket.is_shared.is_(True),
                    ),
                )
            return stmt.where(
                or_(
                    Ticket.is_major.is_(True),
                    Ticket.reporter_user_id == user.id,
                )
            )
        return stmt.where(_end_user_list_visibility(user))
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


def _submitter_can_access_ticket(user: User, ticket: Ticket, org_id: uuid.UUID | None) -> bool:
    if ticket.reporter_user_id == user.id:
        return True
    if ticket.is_major and org_id is not None and ticket.organization_id == org_id:
        return True
    return bool(ticket.is_major and getattr(ticket, "is_shared", False))


async def _agent_can_access_ticket(db: AsyncSession, user: User, ticket: Ticket, org_id: uuid.UUID | None) -> bool:
    if org_id is None:
        return True
    if ticket.reporter_user_id == user.id or ticket.assigned_user_id == user.id:
        return True
    team_ids = await get_user_team_ids(db, user.id)
    return bool(ticket.assigned_team_id and ticket.assigned_team_id in team_ids)


async def user_can_access_ticket(db: AsyncSession, user: User, ticket: Ticket) -> bool:
    if has_full_ticket_visibility(user):
        return True
    org_id = get_user_organization_id(user)
    if org_id is not None and ticket.organization_id == org_id:
        return True
    if getattr(ticket, "is_shared", False):
        return True
    if user.role == ROLE_SUBMITTER:
        return _submitter_can_access_ticket(user, ticket, org_id)
    if user.role == ROLE_AGENT:
        return await _agent_can_access_ticket(db, user, ticket, org_id)
    return False
