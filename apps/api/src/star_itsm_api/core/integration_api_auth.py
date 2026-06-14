"""API-key authentication for the stable integration contract."""

from dataclasses import dataclass
from typing import Annotated

from fastapi import Header, HTTPException, status

from star_itsm_api.core.config import settings
from star_itsm_api.core.integration_auth import verify_integration_secret


@dataclass(frozen=True)
class IntegrationClient:
    """Resolved machine client for integration API calls."""

    system: str
    organization_id: str | None


def _normalize_integration_system(value: str | None) -> str:
    cleaned = (value or "external").strip().lower()
    if not cleaned:
        return "external"
    if len(cleaned) > 64:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Integration-System must be at most 64 characters",
        )
    return cleaned


async def get_integration_client(
    x_integration_key: Annotated[str | None, Header(alias="X-Integration-Key")] = None,
    x_integration_system: Annotated[str | None, Header(alias="X-Integration-System")] = None,
) -> IntegrationClient:
    verify_integration_secret(
        configured_secret=settings.integration_api_key,
        provided=x_integration_key,
        integration_name="INTEGRATION_API_KEY",
    )
    org_id = (settings.integration_org_id or "").strip() or None
    return IntegrationClient(
        system=_normalize_integration_system(x_integration_system),
        organization_id=org_id,
    )
