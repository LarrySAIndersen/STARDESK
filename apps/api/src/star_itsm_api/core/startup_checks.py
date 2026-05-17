"""Fail fast in production when required secrets are missing or weak."""

import logging

from star_itsm_api.core.config import settings

logger = logging.getLogger(__name__)

_WEAK_JWT_SECRETS = frozenset(
    {
        "",
        "change-me",
        "change-me-in-production-use-a-long-random-string",
    }
)


def validate_production_settings() -> None:
    if not settings.is_production:
        return

    errors: list[str] = []

    secret = (settings.jwt_secret or "").strip()
    if not secret or secret.lower() in _WEAK_JWT_SECRETS or len(secret) < 32:
        errors.append("JWT_SECRET must be a random string of at least 32 characters")

    if not settings.cron_secret:
        errors.append("CRON_SECRET must be set when APP_ENV=production")

    if not settings.webhook_secret:
        errors.append("WEBHOOK_SECRET must be set when APP_ENV=production")

    if errors:
        message = "Production security configuration invalid: " + "; ".join(errors)
        logger.critical(message)
        raise RuntimeError(message)
