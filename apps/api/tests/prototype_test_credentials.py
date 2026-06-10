"""Synthetic credentials for pytest only — not production secrets."""

from star_itsm_api.core.demo import PROTOTYPE_BOOTSTRAP_PASSWORD
from star_itsm_api.core.prototype_credentials import prototype_bootstrap_password_hash

KNOWN_PASSWORD = PROTOTYPE_BOOTSTRAP_PASSWORD
BOOTSTRAP_HASH = prototype_bootstrap_password_hash()
LARRY_PASSWORD = PROTOTYPE_BOOTSTRAP_PASSWORD
NEW_VALID_PASSWORD = "nyadgang2026"  # NOSONAR python:S2068
NEW_INVALID_PASSWORD = "invalid1!"  # NOSONAR python:S2068
ADMIN_RESET_PASSWORD = "NyAdgang2026!"  # NOSONAR python:S2068
CLONE_INITIAL_PASSWORD = "NyAdgang2026"  # NOSONAR python:S2068
TEMP_ADMIN_PASSWORD = "TempPass1234"  # NOSONAR python:S2068
PLACEHOLDER_HASH = "old"  # NOSONAR python:S2068
WRONG_CURRENT_PASSWORD = "ForkertKode2026!"  # NOSONAR python:S2068
