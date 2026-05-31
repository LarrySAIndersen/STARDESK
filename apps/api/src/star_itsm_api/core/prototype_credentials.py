"""Documented prototype login passwords — keep in sync with docs/demo-users-and-access.md."""

from star_itsm_api.core.demo import PROTOTYPE_BOOTSTRAP_PASSWORD
from star_itsm_api.core.security import hash_prototype_password

LARRY_PROTOTYPE_PASSWORD = "password"
LARRY_PROTOTYPE_PEPPER = "larry-demo-v1"
BOOTSTRAP_PROTOTYPE_PEPPER = "example-dk-v1"

PROTOTYPE_STAFF_PASSWORDS: dict[str, str] = {
    "larrysanders@example.dk": LARRY_PROTOTYPE_PASSWORD,
    "larrysanders2@example.dk": LARRY_PROTOTYPE_PASSWORD,
}


def documented_prototype_password(email: str) -> str | None:
    """Return the documented demo password for @example.dk users, or None."""
    normalized = email.lower().strip()
    if not normalized.endswith("@example.dk"):
        return None
    return PROTOTYPE_STAFF_PASSWORDS.get(normalized, PROTOTYPE_BOOTSTRAP_PASSWORD)


def larry_prototype_password_hash() -> str:
    return hash_prototype_password(LARRY_PROTOTYPE_PASSWORD, pepper=LARRY_PROTOTYPE_PEPPER)


def prototype_bootstrap_password_hash() -> str:
    return hash_prototype_password(PROTOTYPE_BOOTSTRAP_PASSWORD, pepper=BOOTSTRAP_PROTOTYPE_PEPPER)
