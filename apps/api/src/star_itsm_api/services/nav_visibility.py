"""Sidebar navigation visibility — hidden items are top-admin only."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.platform_setting import PlatformSetting

SIDEBAR_HIDDEN_NAV_KEY = "sidebar_hidden_nav_ids"

# Keep in sync with apps/web/src/lib/agent-nav.ts
VALID_NAV_IDS = frozenset(
    {
        "dashboard",
        "service-desk",
        "classic-ui",
        "tickets",
        "tickets-new",
        "assets",
        "knowledge",
        "groups",
        "users",
        "reports",
        "admin-sla",
        "admin-categories",
        "admin-dependencies",
        "portal",
        "integration-slack",
        "integration-gmail",
        "integration-jira",
        "integration-topdesk",
    }
)


def _normalize_ids(raw: object) -> list[str]:
    if not isinstance(raw, list):
        return []
    ids: list[str] = []
    for item in raw:
        if isinstance(item, str) and item in VALID_NAV_IDS and item not in ids:
            ids.append(item)
    return ids


async def get_hidden_nav_ids(db: AsyncSession) -> list[str]:
    try:
        row = await db.get(PlatformSetting, SIDEBAR_HIDDEN_NAV_KEY)
    except Exception:
        return []
    if row is None:
        return []
    return _normalize_ids(row.value)


async def set_hidden_nav_ids(db: AsyncSession, nav_ids: list[str]) -> list[str]:
    normalized = _normalize_ids(nav_ids)
    row = await db.get(PlatformSetting, SIDEBAR_HIDDEN_NAV_KEY)
    if row is None:
        row = PlatformSetting(key=SIDEBAR_HIDDEN_NAV_KEY, value=normalized)
        db.add(row)
    else:
        row.value = normalized
    await db.commit()
    return normalized


async def is_nav_path_hidden_for_user(
    db: AsyncSession,
    *,
    path: str,
    is_top_admin: bool,
) -> bool:
    if is_top_admin:
        return False
    from star_itsm_api.services.nav_visibility_paths import nav_id_for_path

    hidden = await get_hidden_nav_ids(db)
    if not hidden:
        return False
    nav_id = nav_id_for_path(path)
    if nav_id is None:
        return False
    return nav_id in hidden
