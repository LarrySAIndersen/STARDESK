"""Map nav ids to URL prefixes — keep in sync with apps/web/src/lib/agent-nav.ts."""

NAV_PATH_BY_ID: dict[str, str] = {
    "dashboard": "/",
    "min-side": "/min-side",
    "sitemap": "/sitemap",
    "projekter": "/projekter",
    "arbejdsrum": "/arbejdsrum",
    "service-desk": "/service-desk",
    "kanban": "/kanban",
    "backlog": "/backlog",
    "classic-ui": "/classic",
    "team-chat": "/chat",
    "tickets": "/tickets",
    "tickets-new": "/tickets/new",
    "assets": "/aktiver",
    "knowledge": "/knowledge",
    "team-wiki": "/teamwiki",
    "groups": "/groups",
    "forbedringer": "/forbedringer",
    "saglayout-2": "/forbedringer/saglayout-2",
    "users": "/users",
    "reports": "/reports",
    "admin-dashboard": "/admin/dashboard",
    "admin-chatbot": "/admin/chatbot",
    "admin-sla": "/admin/sla",
    "admin-categories": "/admin/categories",
    "admin-dependencies": "/admin/dependencies",
    "system-dokumentation": "/system-dokumentation",
    "portal": "/portal",
    "kundeportal-2": "/kundeportal-2",
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
