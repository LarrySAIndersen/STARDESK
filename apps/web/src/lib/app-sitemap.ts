import { LayoutDashboard, BookOpen } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  buildAgentNavItems,
  filterNavItemsForViewer,
  type AgentNavItem,
} from "@/lib/agent-nav";
import {
  defaultSectionForItem,
  NAV_SECTIONS,
  type NavSectionId,
} from "@/lib/agent-nav-config";
import { canManageUsers, isStaff, isTopAdmin } from "@/lib/auth";
import type { User } from "@/types/user";

/** Serializable link — safe to pass from Server Components to Client Components. */
export type AppSitemapLink = {
  id: string;
  href: string;
  label: string;
};

export type AppSitemapSection = {
  id: NavSectionId;
  label: string;
  items: AppSitemapLink[];
};

const SECTION_LABELS: Record<NavSectionId, string> = {
  main: "Hovednavigation",
  projekt: "Projekt",
  graenseflade: "Grænseflade",
  forbedringer: "Forbedringer",
  administration: "Administration",
  slutbrugere: "Slutbrugere",
  integration: "Integration",
};

const STAFF_EXTRA_ITEMS: AgentNavItem[] = [
  {
    id: "arbejdsrum",
    href: "/arbejdsrum",
    label: "Arbejdsrum overblik",
    icon: LayoutDashboard,
  },
];

function toSitemapLink(item: AgentNavItem): AppSitemapLink {
  return { id: item.id, href: item.href, label: item.label };
}

export function buildAppSitemapSections(
  user: User,
  hiddenNavIds: string[],
): AppSitemapSection[] {
  const staff = isStaff(user);
  const showAdmin = canManageUsers(user);
  const topAdmin = isTopAdmin(user);

  let items = filterNavItemsForViewer(
    buildAgentNavItems({
      staff,
      showAdmin,
      showForbedringer: staff,
    }),
    hiddenNavIds,
    topAdmin,
  );

  if (staff) {
    const extras = STAFF_EXTRA_ITEMS.filter(
      (item) => topAdmin || !hiddenNavIds.includes(item.id),
    );
    const homeIndex = items.findIndex((item) => item.id === "dashboard");
    const insertAt = homeIndex >= 0 ? homeIndex + 1 : 0;
    items = [
      ...items.slice(0, insertAt),
      ...extras,
      ...items.slice(insertAt),
    ];
  }

  const buckets = new Map<NavSectionId, AppSitemapLink[]>(
    NAV_SECTIONS.map((section) => [section.id, []]),
  );

  for (const item of items) {
    const sectionId = defaultSectionForItem(item);
    const bucket = buckets.get(sectionId);
    if (bucket) {
      bucket.push(toSitemapLink(item));
    }
  }

  return NAV_SECTIONS
    .map((section) => ({
      id: section.id,
      label: section.label ?? SECTION_LABELS.main,
      items: buckets.get(section.id) ?? [],
    }))
    .filter((section) => section.items.length > 0);
}

export function filterAppSitemapSections(
  sections: AppSitemapSection[],
  query: string,
): AppSitemapSection[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return sections;
  }
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.label.toLowerCase().includes(needle) ||
          item.href.toLowerCase().includes(needle),
      ),
    }))
    .filter((section) => section.items.length > 0);
}

export function isExternalNavHref(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

/** Lucide icons keyed by nav id — client-only resolution. */
const NAV_ICON_BY_ID: Record<string, LucideIcon> = (() => {
  const map: Record<string, LucideIcon> = {};
  for (const item of buildAgentNavItems({
    staff: true,
    showAdmin: true,
    showForbedringer: true,
  })) {
    map[item.id] = item.icon;
  }
  map.arbejdsrum = LayoutDashboard;
  map["team-wiki"] = BookOpen;
  return map;
})();

export function navIconForItemId(id: string): LucideIcon {
  return NAV_ICON_BY_ID[id] ?? LayoutDashboard;
}
