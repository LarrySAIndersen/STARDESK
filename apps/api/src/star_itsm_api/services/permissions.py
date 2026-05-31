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
from star_itsm_api.services.user_roles import user_has_any_role, user_role_set

ADMIN_ROLES = frozenset({ROLE_TOP_ADMIN, ROLE_ADMIN, ROLE_SUPPORTER})
STAFF_ROLES = frozenset({ROLE_TOP_ADMIN, ROLE_ADMIN, ROLE_AGENT, ROLE_SUPPORTER})


def is_top_admin(user: User) -> bool:
    return user_has_any_role(user, ROLE_TOP_ADMIN)


def is_admin(user: User) -> bool:
    return bool(user_role_set(user) & ADMIN_ROLES)


def is_staff_role(user: User) -> bool:
    return bool(user_role_set(user) & STAFF_ROLES)


def is_end_user(user: User) -> bool:
    roles = user_role_set(user)
    return ROLE_SUBMITTER in roles and not (roles & STAFF_ROLES)


def is_stardesk_reviewer(user: User) -> bool:
    return user_has_any_role(user, ROLE_STARDESK_REVIEWER)


def has_full_ticket_visibility(user: User) -> bool:
    """Top admin and admin see all tickets."""
    return bool(user_role_set(user) & ADMIN_ROLES)


def can_manage_users(user: User) -> bool:
    """Assign users and change configuration (admin + top admin)."""
    return bool(user_role_set(user) & ADMIN_ROLES)


def can_export_tickets(user: User) -> bool:
    """Excel/CSV export — staff only; scoped by org_access."""
    return bool(user_role_set(user) & STAFF_ROLES)


def can_assign_tickets(user: User) -> bool:
    return user_has_any_role(user, ROLE_TOP_ADMIN, ROLE_ADMIN, ROLE_AGENT, ROLE_SUPPORTER)


def staff_roles_tuple() -> tuple[str, ...]:
    return tuple(STAFF_ROLES)


def admin_roles_tuple() -> tuple[str, ...]:
    return tuple(ADMIN_ROLES)
