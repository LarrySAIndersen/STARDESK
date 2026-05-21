"""Only one account may hold top_admin — configured by email."""

import os

from star_itsm_api.core.security import ROLE_ADMIN, ROLE_TOP_ADMIN
from star_itsm_api.models.user import User

DEFAULT_SOLE_TOP_ADMIN_EMAIL = "larrysanders@example.dk"


def sole_top_admin_email() -> str:
    return os.getenv("SOLE_TOP_ADMIN_EMAIL", DEFAULT_SOLE_TOP_ADMIN_EMAIL).lower().strip()


def is_sole_top_admin_email(email: str) -> bool:
    return email.lower().strip() == sole_top_admin_email()


def can_hold_top_admin_role(email: str) -> bool:
    return is_sole_top_admin_email(email)


def is_top_admin_user(user: User) -> bool:
    return user.role == ROLE_TOP_ADMIN


def can_assign_top_admin_role(actor: User) -> bool:
    return is_top_admin_user(actor) and is_sole_top_admin_email(actor.email)


def assert_may_assign_role(*, actor: User, target_email: str, new_role: str) -> None:
    if new_role != ROLE_TOP_ADMIN:
        return
    if not can_hold_top_admin_role(target_email):
        raise ValueError("top_admin_reserved")
    if not can_assign_top_admin_role(actor):
        raise ValueError("top_admin_assign_forbidden")


def role_after_top_admin_policy(email: str, requested_role: str) -> str:
    """Demote top_admin for non-reserved emails; promote reserved email when requested."""
    if requested_role == ROLE_TOP_ADMIN and not can_hold_top_admin_role(email):
        return ROLE_ADMIN
    return requested_role
