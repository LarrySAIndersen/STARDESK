"""Shared prototype credentials (keep in sync with apps/web demo-users and seed SQL)."""

import os

_ENV_KEY = "PROTOTYPE_BOOTSTRAP_PASSWORD"


def get_prototype_bootstrap_password() -> str:
    """Prototype-only demo password from env; never hard-coded in source."""
    value = (os.environ.get(_ENV_KEY) or "").strip()
    if not value:
        msg = (
            f"{_ENV_KEY} must be set for prototype demo/bootstrap "
            "(see apps/api/.env.development.example)."
        )
        raise RuntimeError(msg)
    return value


def __getattr__(name: str) -> str:
    if name == "PROTOTYPE_BOOTSTRAP_PASSWORD":
        return get_prototype_bootstrap_password()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
