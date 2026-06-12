import type {
  WorkspaceLandingConfig,
  WorkspaceSpace,
  WorkspaceWidgetDefinition,
  WorkspaceWidgetInstance,
  WorkspaceWidgetKind,
} from "@/lib/workspace-landing/types";

export const WORKSPACE_WIDGET_CATALOG: WorkspaceWidgetDefinition[] = [
  {
    kind: "personal-dashboard",
    label: "Driftsdashboard",
    description: "KPI'er og grafer for dine sager.",
    space: "personal",
    defaultSpan: "full",
  },
  {
    kind: "dispatch-queue",
    label: "Fordeling af nye sager",
    description: "Nye sager og træk-og-slip til grupper.",
    space: "personal",
    defaultSpan: "full",
  },
  {
    kind: "personal-notes",
    label: "Post-it tavle",
    description: "Personlige noter og huskeliste.",
    space: "personal",
    defaultSpan: "half",
  },
  {
    kind: "personal-kanban",
    label: "Min kanban",
    description: "Din personlige opgaveliste.",
    space: "personal",
    defaultSpan: "half",
  },
  {
    kind: "my-tickets",
    label: "Mine sager",
    description: "Sager du er involveret i.",
    space: "personal",
    defaultSpan: "full",
  },
  {
    kind: "team-dashboard",
    label: "Team-dashboard",
    description: "KPI'er for dit team og gruppe.",
    space: "team",
    defaultSpan: "full",
  },
  {
    kind: "team-chat",
    label: "Teamchat",
    description: "Kanaler og genvej til samtale.",
    space: "team",
    defaultSpan: "half",
  },
  {
    kind: "team-members",
    label: "Team online",
    description: "Kollegaer i teamchatten.",
    space: "team",
    defaultSpan: "half",
  },
  {
    kind: "team-dispatch",
    label: "Team-kø",
    description: "Nye sager til teamfordeling.",
    space: "team",
    defaultSpan: "full",
  },
];

function createInstance(
  kind: WorkspaceWidgetKind,
  order: number,
  span: WorkspaceWidgetDefinition["defaultSpan"],
): WorkspaceWidgetInstance {
  return {
    instanceId: `${kind}-${order}`,
    kind,
    order,
    span,
    hidden: false,
  };
}

export const DEFAULT_WORKSPACE_LANDING: WorkspaceLandingConfig = {
  personal: [
    createInstance("personal-dashboard", 0, "full"),
    createInstance("dispatch-queue", 1, "full"),
    createInstance("personal-notes", 2, "half"),
    createInstance("personal-kanban", 3, "half"),
    createInstance("my-tickets", 4, "full"),
  ],
  team: [
    createInstance("team-dashboard", 0, "full"),
    createInstance("team-chat", 1, "half"),
    createInstance("team-members", 2, "half"),
    createInstance("team-dispatch", 3, "full"),
  ],
};

export function widgetsForSpace(space: WorkspaceSpace): WorkspaceWidgetDefinition[] {
  return WORKSPACE_WIDGET_CATALOG.filter((item) => item.space === space);
}

export function definitionForKind(kind: WorkspaceWidgetKind): WorkspaceWidgetDefinition {
  const found = WORKSPACE_WIDGET_CATALOG.find((item) => item.kind === kind);
  if (!found) {
    throw new Error(`Unknown workspace widget kind: ${kind}`);
  }
  return found;
}

export function nextWidgetOrder(instances: WorkspaceWidgetInstance[]): number {
  if (instances.length === 0) return 0;
  return Math.max(...instances.map((item) => item.order)) + 1;
}
