import { findAssetById } from "@/lib/mock-assets";
import { DEFAULT_TICKET_SORT, parseTicketSort } from "@/lib/ticket-sort";

/** Build GET /api/v1/tickets query string from dashboard drill-down search params. */

function pick(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function pickTruthyFlag(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): boolean {
  return pick(searchParams[key]) === "true";
}

export function buildTicketsApiQuery(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();
  params.set("limit", "500");

  const scope = pick(searchParams.scope);
  if (scope) {
    params.set("scope", scope);
  }
  if (pickTruthyFlag(searchParams, "open_only")) {
    params.set("open_only", "true");
  }
  const bucket = pick(searchParams.bucket);
  if (bucket) {
    params.set("bucket", bucket);
  }
  const sla = pick(searchParams.sla);
  if (sla) {
    params.set("sla", sla);
  }
  if (pickTruthyFlag(searchParams, "major_open")) {
    params.set("major_open", "true");
  }
  const opened = pick(searchParams.opened_since_days);
  if (opened) {
    params.set("opened_since_days", opened);
  }
  const closed = pick(searchParams.closed_since_days);
  if (closed) {
    params.set("closed_since_days", closed);
  }
  const status = pick(searchParams.status);
  if (status) {
    params.set("status", status);
  }
  const priority = pick(searchParams.priority);
  if (priority) {
    params.set("priority", priority);
  }
  const createdOn = pick(searchParams.created_on);
  if (createdOn) {
    params.set("created_on", createdOn);
  }
  const closedOn = pick(searchParams.closed_on);
  if (closedOn) {
    params.set("closed_on", closedOn);
  }
  const ticketType = pick(searchParams.ticket_type);
  if (ticketType) {
    params.set("ticket_type", ticketType);
  }
  if (pickTruthyFlag(searchParams, "security_only")) {
    params.set("security_only", "true");
  }
  if (pickTruthyFlag(searchParams, "is_store")) {
    params.set("is_store", "true");
  }
  const parentId = pick(searchParams.parent_id);
  if (parentId) {
    params.set("parent_id", parentId);
  }
  const assignedTeamId = pick(searchParams.assigned_team_id);
  if (assignedTeamId) {
    params.set("assigned_team_id", assignedTeamId);
  }

  const hasDashboardFilter =
    scope ||
    bucket ||
    sla ||
    opened ||
    closed ||
    status ||
    priority ||
    createdOn ||
    closedOn ||
    ticketType ||
    parentId ||
    assignedTeamId ||
    pickTruthyFlag(searchParams, "major_open") ||
    pickTruthyFlag(searchParams, "security_only") ||
    pickTruthyFlag(searchParams, "is_store");

  if (!hasDashboardFilter) {
    params.set("board", "true");
    params.set("open_only", "true");
  }

  params.set("sort", parseTicketSort(pick(searchParams.sort)));

  return params.toString();
}

export function dashboardFilterTitle(
  searchParams: Record<string, string | string[] | undefined>,
): string | null {
  const parts: string[] = [];
  const scope = pick(searchParams.scope);
  if (scope === "personal") parts.push("personligt overblik");
  else if (scope === "mine") parts.push("mine sager");
  else if (scope === "group") parts.push("min gruppe");
  else if (scope === "created") parts.push("oprettet af mig");
  else if (scope === "all") parts.push("alle sager");

  const bucket = pick(searchParams.bucket);
  if (bucket === "modtaget") parts.push("modtaget");
  else if (bucket === "igangsat") parts.push("igangsat");
  else if (bucket === "lost") parts.push("løst");
  else if (bucket === "lukket") parts.push("lukket");
  else if (bucket === "genaabnet") parts.push("genåbnet");

  const sla = pick(searchParams.sla);
  if (sla === "overdue") parts.push("SLA overskredet");
  else if (sla === "due_soon") parts.push("SLA inden forfald");

  if (pickTruthyFlag(searchParams, "major_open")) parts.push("store sager");
  if (pickTruthyFlag(searchParams, "open_only") && !bucket && !sla) parts.push("åbne sager");
  if (pick(searchParams.opened_since_days) === "7") parts.push("modtaget seneste 7 d");
  if (pick(searchParams.closed_since_days) === "7") parts.push("lukket seneste 7 d");
  const status = pick(searchParams.status);
  if (status) parts.push(`status: ${status}`);
  const priority = pick(searchParams.priority);
  if (priority) parts.push(`prioritet: ${priority}`);
  const createdOn = pick(searchParams.created_on);
  if (createdOn) parts.push(`oprettet ${createdOn}`);
  const closedOn = pick(searchParams.closed_on);
  if (closedOn) parts.push(`lukket ${closedOn}`);
  const ticketType = pick(searchParams.ticket_type);
  if (ticketType) parts.push(`type: ${ticketType}`);
  if (pickTruthyFlag(searchParams, "security_only")) parts.push("sikkerhedssager");
  if (pickTruthyFlag(searchParams, "is_store")) parts.push("store sager (liste)");
  const parentId = pick(searchParams.parent_id);
  if (parentId) parts.push("undersager");
  const assignedTeamId = pick(searchParams.assigned_team_id);
  if (assignedTeamId) parts.push("gruppe");

  const assetId = pick(searchParams.asset_id);
  if (assetId) {
    const asset = findAssetById(assetId);
    parts.push(asset ? `aktiv: ${asset.label}` : `aktiv: ${assetId}`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

const TICKETS_URL_FILTER_KEYS = [
  "scope",
  "open_only",
  "bucket",
  "sla",
  "major_open",
  "opened_since_days",
  "closed_since_days",
  "created_on",
  "closed_on",
  "asset_id",
  "status",
  "priority",
  "ticket_type",
  "security_only",
  "is_store",
  "parent_id",
  "assigned_team_id",
  "sort",
] as const;

/** Whether /tickets has drill-down or list query params beyond the default board view. */
export function hasTicketsUrlFilters(
  searchParams: Record<string, string | string[] | undefined>,
): boolean {
  for (const key of TICKETS_URL_FILTER_KEYS) {
    const raw = pick(searchParams[key]);
    if (!raw) {
      continue;
    }
    if (key === "sort" && parseTicketSort(raw) === DEFAULT_TICKET_SORT) {
      continue;
    }
    return true;
  }
  return false;
}

export const CLEARED_TICKETS_PATH = "/tickets";
