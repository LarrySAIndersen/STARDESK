export type WorkspaceSpace = "personal" | "team";

export type WorkspaceWidgetKind =
  | "personal-dashboard"
  | "dispatch-queue"
  | "personal-notes"
  | "personal-kanban"
  | "my-tickets"
  | "team-dashboard"
  | "team-chat"
  | "team-members"
  | "team-dispatch";

export type WorkspaceWidgetSpan = "full" | "half";

export type WorkspaceWidgetInstance = {
  instanceId: string;
  kind: WorkspaceWidgetKind;
  order: number;
  span: WorkspaceWidgetSpan;
  hidden: boolean;
};

export type WorkspaceLandingConfig = {
  personal: WorkspaceWidgetInstance[];
  team: WorkspaceWidgetInstance[];
};

export type WorkspaceWidgetDefinition = {
  kind: WorkspaceWidgetKind;
  label: string;
  description: string;
  space: WorkspaceSpace;
  defaultSpan: WorkspaceWidgetSpan;
};
