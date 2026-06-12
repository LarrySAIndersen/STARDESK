import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bot,
  Columns3,
  Headset,
  Inbox,
  Layers,
  LayoutDashboard,
  Library,
  Mail,
  MessageSquare,
  Plus,
  LayoutGrid,
  LayoutTemplate,
  StickyNote,
  Ticket,
  Shield,
  Settings2,
  UserCog,
  Users,
  UserCircle,
  Wrench,
} from "lucide-react";

import { canManageNavVisibility } from "@/lib/top-admin";
import { INTEGRATION_META } from "@/lib/integrations-config";
import type { User } from "@/types/user";

export type AgentNavItem = {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  section?: string;
  /** When false, item is omitted from the nav builder (role gates). */
  visible?: boolean;
};

const INTEGRATION_ICONS = {
  slack: MessageSquare,
  gmail: Mail,
  jira: Ticket,
  topdesk: Wrench,
} as const;

export function buildAgentNavItems(options: {
  staff: boolean;
  showAdmin: boolean;
  showForbedringer?: boolean;
}): AgentNavItem[] {
  const { staff, showAdmin, showForbedringer = false } = options;
  return [
    { id: "dashboard", href: "/", label: "Hjem", icon: LayoutDashboard },
    ...(staff
      ? [{ id: "service-desk", href: "/service-desk", label: "Service Desk", icon: Headset }]
      : []),
    ...(staff
      ? [{ id: "kanban", href: "/kanban", label: "Kanban", icon: Columns3 }]
      : []),
    ...(staff
      ? [{ id: "backlog", href: "/backlog", label: "Backlog", icon: Inbox }]
      : []),
    { id: "tickets", href: "/tickets", label: "Alle sager", icon: Ticket },
    { id: "tickets-new", href: "/tickets/new", label: "Ny sag", icon: Plus },
    ...(staff ? [{ id: "assets", href: "/aktiver", label: "Aktiver", icon: Layers }] : []),
    ...(staff
      ? [{ id: "knowledge", href: "/knowledge", label: "Vidensartikler", icon: Library }]
      : []),
    ...(staff ? [{ id: "groups", href: "/groups", label: "Grupper", icon: Users }] : []),
    ...(showForbedringer
      ? [
          {
            id: "forbedringer",
            href: "/forbedringer",
            label: "Review-sedler",
            icon: StickyNote,
            section: "Forbedringer",
          },
          {
            id: "saglayout-2",
            href: "/forbedringer/saglayout-2",
            label: "Saglayout #2",
            icon: LayoutTemplate,
            section: "Forbedringer",
          },
        ]
      : []),
    ...(showAdmin ? [{ id: "users", href: "/users", label: "Brugere", icon: UserCog }] : []),
    { id: "reports", href: "/reports", label: "Rapporter", icon: BarChart3 },
    ...(showAdmin
      ? [
          {
            id: "admin-dashboard",
            href: "/admin/dashboard",
            label: "Admin dashboard",
            icon: Settings2,
            section: "Administration",
          },
          {
            id: "admin-chatbot",
            href: "/admin/chatbot",
            label: "Chatbot",
            icon: Bot,
            section: "Administration",
          },
          {
            id: "admin-sla",
            href: "/admin/sla",
            label: "SLA-indstillinger",
            icon: Shield,
            section: "Administration",
          },
          {
            id: "admin-categories",
            href: "/admin/categories",
            label: "Kategorier",
            icon: Shield,
            section: "Administration",
          },
          {
            id: "admin-dependencies",
            href: "/admin/dependencies",
            label: "Afhængigheder & sikkerhed",
            icon: Shield,
            section: "Administration",
          },
          {
            id: "dependency-track",
            href: process.env.NEXT_PUBLIC_DEPENDENCYTRACK_EXTERNAL_URL || "http://localhost:8081",
            label: "Dependency-Track",
            icon: Shield,
            section: "Administration",
          },
        ]
      : []),
    {
      id: "portal",
      href: "/portal",
      label: "Selvbetjeningsportal",
      icon: UserCircle,
      section: "Slutbrugere",
    },
    {
      id: "kundeportal-2",
      href: "/kundeportal-2",
      label: "Kundeportal #2",
      icon: LayoutGrid,
      section: "Slutbrugere",
    },
    ...(staff
      ? INTEGRATION_META.map((meta) => ({
          id: `integration-${meta.id}`,
          href: meta.href,
          label: meta.name,
          icon: INTEGRATION_ICONS[meta.id],
          section: "Integration",
        }))
      : []),
  ];
}

/** Classic UI switch is not a separate nav id in the list — handled beside service desk. */
export const CLASSIC_UI_NAV_ID = "classic-ui";

export function filterNavItemsForViewer(
  items: AgentNavItem[],
  hiddenNavIds: string[],
  isTopAdmin: boolean,
): AgentNavItem[] {
  if (isTopAdmin || hiddenNavIds.length === 0) {
    return items;
  }
  const hidden = new Set(hiddenNavIds);
  return items.filter((item) => !hidden.has(item.id));
}

/** First staff route that is not hidden — fallback when blocked from current path. */
export function firstAllowedStaffPath(
  hiddenNavIds: string[],
  isTopAdmin: boolean,
): string {
  const items = buildAgentNavItems({ staff: true, showAdmin: true });
  const visible = filterNavItemsForViewer(items, hiddenNavIds, isTopAdmin);
  return visible[0]?.href ?? "/service-desk";
}

export function isStaffPathBlocked(
  pathname: string,
  hiddenNavIds: string[],
  user: User | null,
): boolean {
  if (!user) {
    return false;
  }
  return isNavPathHidden(pathname, hiddenNavIds, canManageNavVisibility(user));
}

export function isNavPathHidden(
  pathname: string,
  hiddenNavIds: string[],
  isTopAdmin: boolean,
): boolean {
  if (isTopAdmin || hiddenNavIds.length === 0) {
    return false;
  }
  const items = buildAgentNavItems({ staff: true, showAdmin: true });
  const hidden = new Set(hiddenNavIds);
  for (const item of items) {
    if (!hidden.has(item.id)) {
      continue;
    }
    if (item.href === "/") {
      if (pathname === "/") {
        return true;
      }
      continue;
    }
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      return true;
    }
  }
  return false;
}
