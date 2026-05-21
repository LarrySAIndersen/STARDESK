"""Map nav ids to URL prefixes — keep in sync with apps/web/src/lib/agent-nav.ts."""

NAV_PATH_BY_ID: dict[str, str] = {
    "dashboard": "/",
    "service-desk": "/service-desk",
    "classic-ui": "/classic",
    "tickets": "/tickets",
    "tickets-new": "/tickets/new",
    "assets": "/aktiver",
    "knowledge": "/knowledge",
    "groups": "/groups",
    "users": "/users",
    "reports": "/reports",
    "admin-sla": "/admin/sla",
    "admin-categories": "/admin/categories",
    "admin-dependencies": "/admin/dependencies",
    "portal": "/portal",
    "integration-slack": "/integrations/slack",
    "integration-gmail": "/integrations/gmail",
    "integration-jira": "/integrations/jira",
    "integration-topdesk": "/integrations/topdesk",
}


def path_for_nav_id(nav_id: str) -> str | None:
    return NAV_PATH_BY_ID.get(nav_id)


def nav_id_for_path(path: str) -> str | None:
    if path == "/":
        return "dashboard"
    best: tuple[int, str] | None = None
    for nav_id, prefix in NAV_PATH_BY_ID.items():
        if prefix == "/":
            continue
        if path == prefix or path.startswith(f"{prefix}/"):
            length = len(prefix)
            if best is None or length > best[0]:
                best = (length, nav_id)
    return best[1] if best else None
