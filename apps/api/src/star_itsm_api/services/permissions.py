"""Rights-group (rettighedsgruppe) capabilities — separate from dispatch teams."""

from star_itsm_api.core.security import (
    ROLE_ADMIN,
    ROLE_AGENT,
    ROLE_STARDESK_REVIEWER,
    ROLE_SUBMITTER,
    ROLE_SUPPORTER,
    ROLE_TOP_ADMIN,
)
from star_itsm_api.models.user import User

ADMIN_ROLES = frozenset({ROLE_TOP_ADMIN, ROLE_ADMIN, ROLE_SUPPORTER})
STAFF_ROLES = frozenset({ROLE_TOP_ADMIN, ROLE_ADMIN, ROLE_AGENT, ROLE_SUPPORTER})


def is_top_admin(user: User) -> bool:
    return user.role == ROLE_TOP_ADMIN


def is_admin(user: User) -> bool:
    return user.role in ADMIN_ROLES


def is_staff_role(user: User) -> bool:
    return user.role in STAFF_ROLES


def is_end_user(user: User) -> bool:
    return user.role == ROLE_SUBMITTER


def is_stardesk_reviewer(user: User) -> bool:
    return user.role == ROLE_STARDESK_REVIEWER


def has_full_ticket_visibility(user: User) -> bool:
    """Top admin and admin see all tickets."""
    return user.role in ADMIN_ROLES


def can_manage_users(user: User) -> bool:
    """Assign users and change configuration (admin + top admin)."""
    return user.role in ADMIN_ROLES


def can_export_tickets(user: User) -> bool:
    """Excel/CSV export — staff only; scoped by org_access."""
    return user.role in STAFF_ROLES


def can_assign_tickets(user: User) -> bool:
    return user.role in {ROLE_TOP_ADMIN, ROLE_ADMIN, ROLE_AGENT, ROLE_SUPPORTER}


def staff_roles_tuple() -> tuple[str, ...]:
    return tuple(STAFF_ROLES)


def admin_roles_tuple() -> tuple[str, ...]:
    return tuple(ADMIN_ROLES)
