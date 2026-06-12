import type { WorkspaceWidgetKind } from "@/lib/workspace-landing/types";

export type SchemaColumn = {
  name: string;
  type: string;
  note: string;
};

export type WidgetDatabaseSource = {
  tables: readonly string[];
  idField: string;
  note: string;
};

export const WORKSPACE_LAYOUT_TABLE = {
  name: "user_workspace_layouts",
  apiPath: "/api/v1/workspace/landing",
  sqlMigration: "39_workspace-layout.sql",
  columns: [
    { name: "user_id", type: "UUID", note: "PK, FK → users.id ON DELETE CASCADE" },
    { name: "layout", type: "JSONB", note: "{ personal: WidgetInstance[], team: WidgetInstance[] }" },
    { name: "layout_version", type: "INTEGER", note: "Schema-version (default 1)" },
    { name: "created_at", type: "TIMESTAMPTZ", note: "" },
    { name: "updated_at", type: "TIMESTAMPTZ", note: "" },
  ] satisfies SchemaColumn[],
} as const;

export const WORKSPACE_WIDGET_INSTANCE_FIELDS: SchemaColumn[] = [
  { name: "instance_id", type: "string", note: "Stabil widget-id (fx personal-dashboard-0)" },
  { name: "kind", type: "string", note: "Widget-type fra katalog" },
  { name: "order", type: "integer", note: "Visningsrækkefølge (0-baseret)" },
  { name: "span", type: "full | half", note: "Kolonnebredde på overblik" },
  { name: "hidden", type: "boolean", note: "Skjult fra overblik/sitemap" },
];

export const WIDGET_DATABASE_SOURCES: Record<WorkspaceWidgetKind, WidgetDatabaseSource> = {
  "personal-dashboard": {
    tables: ["tickets", "teams", "ticket_events"],
    idField: "tickets.id",
    note: "KPI'er aggregeres fra sager og team-tildeling.",
  },
  "dispatch-queue": {
    tables: ["tickets", "teams"],
    idField: "tickets.id",
    note: "Nye sager (status new) til fordeling.",
  },
  "personal-notes": {
    tables: ["personal_notes"],
    idField: "personal_notes.id",
    note: "Post-it noter per bruger; kan kobles til tickets.id.",
  },
  "personal-kanban": {
    tables: ["personal_kanban_cards", "tickets"],
    idField: "personal_kanban_cards.ticket_id",
    note: "Personlig kanban-kolonne per sag.",
  },
  "my-tickets": {
    tables: ["tickets", "ticket_stakeholders"],
    idField: "tickets.id",
    note: "Sager hvor brugeren er tildelt eller stakeholder.",
  },
  "team-dashboard": {
    tables: ["tickets", "teams", "team_members"],
    idField: "teams.id",
    note: "Team-KPI'er filtreret på gruppe.",
  },
  "team-chat": {
    tables: ["team_chat_channels", "team_chat_messages", "team_chat_channel_members"],
    idField: "team_chat_channels.id",
    note: "Intern team-chat kanaler og beskeder.",
  },
  "team-members": {
    tables: ["users", "sf_chat_presence", "team_members"],
    idField: "users.id",
    note: "Online-status og team-medlemskab.",
  },
  "team-dispatch": {
    tables: ["tickets", "teams"],
    idField: "tickets.id",
    note: "Team-kø til fordeling af nye sager.",
  },
};

export function databaseSourceForKind(kind: WorkspaceWidgetKind): WidgetDatabaseSource {
  return WIDGET_DATABASE_SOURCES[kind];
}

export function formatLayoutTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("da-DK", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
