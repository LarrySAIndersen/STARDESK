"""Documented prototype login passwords — keep in sync with docs/demo-users-and-access.md."""

from star_itsm_api.core.demo import get_prototype_bootstrap_password
from star_itsm_api.core.security import hash_prototype_password

BOOTSTRAP_PROTOTYPE_PEPPER = "example-dk-v1"


def documented_prototype_password(email: str) -> str | None:
    """Return the documented demo password for @example.dk users, or None."""
    normalized = email.lower().strip()
    if not normalized.endswith("@example.dk"):
        return None
    try:
        return get_prototype_bootstrap_password()
    except RuntimeError:
        return None


def prototype_bootstrap_password_hash() -> str:
    return hash_prototype_password(
        get_prototype_bootstrap_password(),
        pepper=BOOTSTRAP_PROTOTYPE_PEPPER,
    )
