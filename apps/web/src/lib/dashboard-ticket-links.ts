/** Query params for dashboard KPI drill-down to /tickets. */

export type DashboardScope = "personal" | "mine" | "group" | "created" | "all";

export type DashboardTicketFilter = {
  scope?: DashboardScope;
  openOnly?: boolean;
  bucket?: string;
  sla?: "overdue" | "due_soon";
  majorOpen?: boolean;
  openedSinceDays?: number;
  closedSinceDays?: number;
  status?: string;
  priority?: string;
  /** Calendar day YYYY-MM-DD — tickets created that day. */
  createdOn?: string;
  /** Calendar day YYYY-MM-DD — tickets closed/resolved that day. */
  closedOn?: string;
  ticketType?: string;
  securityOnly?: boolean;
  isStore?: boolean;
  parentId?: string;
  assignedTeamId?: string;
};

export function buildTicketsFilterHref(filter: DashboardTicketFilter): string {
  const params = new URLSearchParams();
  if (filter.scope) {
    params.set("scope", filter.scope);
  }
  if (filter.openOnly) {
    params.set("open_only", "true");
  }
  if (filter.bucket) {
    params.set("bucket", filter.bucket);
  }
  if (filter.sla) {
    params.set("sla", filter.sla);
  }
  if (filter.majorOpen) {
    params.set("major_open", "true");
  }
  if (filter.openedSinceDays != null) {
    params.set("opened_since_days", String(filter.openedSinceDays));
  }
  if (filter.closedSinceDays != null) {
    params.set("closed_since_days", String(filter.closedSinceDays));
  }
  if (filter.status) {
    params.set("status", filter.status);
  }
  if (filter.priority) {
    params.set("priority", filter.priority);
  }
  if (filter.createdOn) {
    params.set("created_on", filter.createdOn);
  }
  if (filter.closedOn) {
    params.set("closed_on", filter.closedOn);
  }
  if (filter.ticketType) {
    params.set("ticket_type", filter.ticketType);
  }
  if (filter.securityOnly) {
    params.set("security_only", "true");
  }
  if (filter.isStore) {
    params.set("is_store", "true");
  }
  if (filter.parentId) {
    params.set("parent_id", filter.parentId);
  }
  if (filter.assignedTeamId) {
    params.set("assigned_team_id", filter.assignedTeamId);
  }
  const qs = params.toString();
  return qs ? `/tickets?${qs}` : "/tickets";
}

export const DASHBOARD_SCOPE_LABELS: Record<DashboardScope, string> = {
  personal: "Personlig",
  mine: "Mine sager",
  group: "Min gruppe",
  created: "Oprettet af mig",
  all: "Alle sager",
};

export const DASHBOARD_SCOPE_DESCRIPTIONS: Record<DashboardScope, string> = {
  personal: "Dine tildelte sager, sager i dine grupper og sager du har oprettet.",
  mine: "Kun sager tildelt dig.",
  group: "Sager tildelt dine grupper.",
  created: "Sager du har oprettet som kontakt.",
  all: "Hele organisationens sager (administrator).",
};
