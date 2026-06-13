/**
 * Sidebar "eye" visibility — ids top-admin can hide from non-top-admin users.
 * Keep in sync with:
 * - apps/api/src/star_itsm_api/services/nav_visibility.py (VALID_NAV_IDS)
 * - apps/api/src/star_itsm_api/services/nav_visibility_paths.py (NAV_PATH_BY_ID)
 */
export const NAV_VISIBILITY_PATH_BY_ID: Record<string, string> = {
  dashboard: "/",
  "min-side": "/min-side",
  sitemap: "/sitemap",
  projekter: "/projekter",
  arbejdsrum: "/arbejdsrum",
  "service-desk": "/service-desk",
  kanban: "/kanban",
  backlog: "/backlog",
  "classic-ui": "/classic",
  "team-chat": "/chat",
  tickets: "/tickets",
  "tickets-new": "/tickets/new",
  assets: "/aktiver",
  knowledge: "/knowledge",
  "team-wiki": "/teamwiki",
  groups: "/groups",
  forbedringer: "/forbedringer",
  "saglayout-2": "/forbedringer/saglayout-2",
  users: "/users",
  reports: "/reports",
  "admin-dashboard": "/admin/dashboard",
  "admin-chatbot": "/admin/chatbot",
  "admin-sla": "/admin/sla",
  "admin-categories": "/admin/categories",
  "admin-dependencies": "/admin/dependencies",
  "system-dokumentation": "/system-dokumentation",
  "dependency-track":
    process.env.NEXT_PUBLIC_DEPENDENCYTRACK_EXTERNAL_URL || "http://localhost:8081",
  portal: "/portal",
  "kundeportal-2": "/kundeportal-2",
  "integration-slack": "/integrations/slack",
  "integration-gmail": "/integrations/gmail",
  "integration-jira": "/integrations/jira",
  "integration-topdesk": "/integrations/topdesk",
};

/** External hrefs — eye hides menu link; direct URL is not path-guarded. */
export const EXTERNAL_NAV_VISIBILITY_IDS = new Set<string>(["dependency-track"]);

export function isNavVisibilityManagedId(navId: string): boolean {
  return navId in NAV_VISIBILITY_PATH_BY_ID;
}

export function navVisibilityPathForId(navId: string): string | undefined {
  return NAV_VISIBILITY_PATH_BY_ID[navId];
}
