"""Keep top_admin exclusive to the configured owner account."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import ROLE_ADMIN, ROLE_TOP_ADMIN
from star_itsm_api.core.top_admin_policy import (
    can_hold_top_admin_role,
    is_sole_top_admin_email,
    sole_top_admin_email,
)
from star_itsm_api.models.user import User


async def enforce_sole_top_admin_on_login(db: AsyncSession, user: User) -> None:
    """Demote stray top_admin rows; ensure owner account holds top_admin."""
    owner_email = sole_top_admin_email()
    changed = False

    if user.role == ROLE_TOP_ADMIN and not can_hold_top_admin_role(user.email):
        user.role = ROLE_ADMIN
        changed = True

    if is_sole_top_admin_email(user.email) and user.role != ROLE_TOP_ADMIN:
        user.role = ROLE_TOP_ADMIN
        changed = True

    others = await db.execute(
        select(User).where(
            func.lower(User.email) != owner_email,
            User.role == ROLE_TOP_ADMIN,
            User.deleted_at.is_(None),
        )
    )
    for other in others.scalars().all():
        other.role = ROLE_ADMIN
        changed = True

    if changed:
        await db.commit()
        await db.refresh(user)
