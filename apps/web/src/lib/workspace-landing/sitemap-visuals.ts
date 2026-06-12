import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Columns3,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  StickyNote,
  Ticket,
  Users,
} from "lucide-react";

import type { WorkspaceSpace, WorkspaceWidgetKind } from "@/lib/workspace-landing/types";

export type WidgetVisual = {
  icon: LucideIcon;
  accent: string;
  accentSoft: string;
  nodeLabel: string;
};

export const WIDGET_VISUALS: Record<WorkspaceWidgetKind, WidgetVisual> = {
  "personal-dashboard": {
    icon: LayoutDashboard,
    accent: "#1a5fb4",
    accentSoft: "#e8f2fc",
    nodeLabel: "Dashboard",
  },
  "dispatch-queue": {
    icon: Inbox,
    accent: "#c41e2a",
    accentSoft: "#fdecee",
    nodeLabel: "Kø",
  },
  "personal-notes": {
    icon: StickyNote,
    accent: "#e6a817",
    accentSoft: "#fef8e8",
    nodeLabel: "Noter",
  },
  "personal-kanban": {
    icon: Columns3,
    accent: "#1a7a44",
    accentSoft: "#e8f6ee",
    nodeLabel: "Kanban",
  },
  "my-tickets": {
    icon: Ticket,
    accent: "#5c4d9a",
    accentSoft: "#f0eef8",
    nodeLabel: "Sager",
  },
  "team-dashboard": {
    icon: BarChart3,
    accent: "#0d7377",
    accentSoft: "#e6f4f5",
    nodeLabel: "Team KPI",
  },
  "team-chat": {
    icon: MessageSquare,
    accent: "#2d6a9f",
    accentSoft: "#eaf3fa",
    nodeLabel: "Chat",
  },
  "team-members": {
    icon: Users,
    accent: "#6b4c9a",
    accentSoft: "#f3effa",
    nodeLabel: "Team",
  },
  "team-dispatch": {
    icon: Inbox,
    accent: "#b45309",
    accentSoft: "#fef3e8",
    nodeLabel: "Team-kø",
  },
};

export const SPACE_VISUALS: Record<
  WorkspaceSpace,
  { label: string; gradient: string; ring: string }
> = {
  personal: {
    label: "Eget space",
    gradient: "linear-gradient(135deg, #1a5fb4 0%, #5c8fd6 100%)",
    ring: "#1a5fb4",
  },
  team: {
    label: "Team space",
    gradient: "linear-gradient(135deg, #0d7377 0%, #3ba99e 100%)",
    ring: "#0d7377",
  },
};

export function visualForKind(kind: WorkspaceWidgetKind): WidgetVisual {
  return WIDGET_VISUALS[kind];
}
