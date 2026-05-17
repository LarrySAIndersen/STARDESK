"""Shared secret verification for cron jobs and inbound webhooks."""

from fastapi import HTTPException, status

from star_itsm_api.core.config import settings


def verify_integration_secret(
    *,
    configured_secret: str | None,
    provided: str | None,
    integration_name: str,
) -> None:
    """Reject missing or wrong secrets; in production, secrets must be configured."""
    if settings.integration_secrets_required and not configured_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"{integration_name} is not configured",
        )
    if not configured_secret:
        return
    if not provided or provided != configured_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid {integration_name} secret",
        )
