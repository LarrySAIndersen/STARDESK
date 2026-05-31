"""Documented prototype login passwords — keep in sync with docs/demo-users-and-access.md."""

from star_itsm_api.core.demo import PROTOTYPE_BOOTSTRAP_PASSWORD

# bcrypt for "password": $2b$12$R4g4tKPsO73abz4FuHtEXuYIwua1Rr3zsfp/N4x3R5h07rV33EzXC
LARRY_PROTOTYPE_PASSWORD = "password"

# bcrypt for LARRY_PROTOTYPE_PASSWORD
LARRY_BCRYPT_HASH = "$2b$12$R4g4tKPsO73abz4FuHtEXuYIwua1Rr3zsfp/N4x3R5h07rV33EzXC"

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
