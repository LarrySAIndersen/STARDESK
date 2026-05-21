import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Headset,
  Layers,
  LayoutDashboard,
  Library,
  Mail,
  MessageSquare,
  Plus,
  Ticket,
  Shield,
  UserCog,
  Users,
  UserCircle,
  Wrench,
} from "lucide-react";

import { INTEGRATION_META } from "@/lib/integrations-config";

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
}): AgentNavItem[] {
  const { staff, showAdmin } = options;
  return [
    { id: "dashboard", href: "/", label: "Dashboard", icon: LayoutDashboard },
    ...(staff
      ? [{ id: "service-desk", href: "/service-desk", label: "Service Desk", icon: Headset }]
      : []),
    { id: "tickets", href: "/tickets", label: "Alle sager", icon: Ticket },
    { id: "tickets-new", href: "/tickets/new", label: "Ny sag", icon: Plus },
    ...(staff ? [{ id: "assets", href: "/aktiver", label: "Aktiver", icon: Layers }] : []),
    ...(staff
      ? [{ id: "knowledge", href: "/knowledge", label: "Vidensartikler", icon: Library }]
      : []),
    ...(staff ? [{ id: "groups", href: "/groups", label: "Grupper", icon: Users }] : []),
    ...(showAdmin ? [{ id: "users", href: "/users", label: "Brugere", icon: UserCog }] : []),
    { id: "reports", href: "/reports", label: "Rapporter", icon: BarChart3 },
    ...(showAdmin
      ? [
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
        ]
      : []),
    {
      id: "portal",
      href: "/portal",
      label: "Selvbetjeningsportal",
      icon: UserCircle,
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
