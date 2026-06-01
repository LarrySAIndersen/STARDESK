from star_itsm_api.core.http_details import (
    INSUFFICIENT_PERMISSIONS
)
from fastapi import HTTPException, status

from star_itsm_api.core.security import is_staff
from star_itsm_api.models.user import User


def resolve_create_security_flag(user: User, requested: bool) -> bool:
    if not requested:
        return False
    if not is_staff(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=INSUFFICIENT_PERMISSIONS,
        )
    return True


def require_staff_for_security_metadata_update(user: User, updates: dict[str, object]) -> None:
    if "is_security_ticket" not in updates:
        return
    if not is_staff(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=INSUFFICIENT_PERMISSIONS,
        )
