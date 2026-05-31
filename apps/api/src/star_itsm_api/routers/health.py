import os

from fastapi import APIRouter

from star_itsm_api.core.config import settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> dict[str, str]:
    """Liveness + environment identity (compare with production via stardesk_env / deployment)."""
    deployment = os.getenv("VERCEL_ENV") or "local"
    return {
        "status": "ok",
        "app_env": settings.app_env,
        "stardesk_env": settings.stardesk_env,
        "deployment": deployment,
    }
