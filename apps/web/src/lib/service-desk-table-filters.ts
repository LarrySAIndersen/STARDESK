import { sortServiceDeskQueue } from "@/lib/service-desk-queue";
import { ticketSourceLabelDa } from "@/lib/ticket-source-label";
import type { Ticket } from "@/types/ticket";

export type ServiceDeskSortKey =
  | "queue"
  | "ticket_number_asc"
  | "ticket_number_desc"
  | "title_asc"
  | "title_desc"
  | "source_asc"
  | "category_asc"
  | "status_asc"
  | "priority_asc"
  | "priority_desc"
  | "sla_asc"
  | "sla_desc"
  | "created_desc"
  | "created_asc";

export type ServiceDeskTableFilters = {
  sort: ServiceDeskSortKey;
  tag: string;
  source: string;
  category: string;
  status: string;
  priority: string;
  sla: string;
};

export const DEFAULT_SERVICE_DESK_TABLE_FILTERS: ServiceDeskTableFilters = {
  sort: "queue",
  tag: "",
  source: "",
  category: "",
  status: "",
  priority: "",
  sla: "",
};

const PRIORITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function ticketSourceFilterValue(ticket: Ticket): string {
  return ticket.source?.trim() || "other";
}

export function ticketSourceFilterLabel(sourceKey: string): string {
  if (sourceKey === "other") {
    return "Andet";
  }
  return ticketSourceLabelDa(sourceKey);
}

export function applyServiceDeskTableFilters(
  tickets: Ticket[],
  filters: ServiceDeskTableFilters,
): Ticket[] {
  return tickets.filter((ticket) => {
    if (filters.tag && !(ticket.tags ?? []).includes(filters.tag)) {
      return false;
    }
    if (filters.source && ticketSourceFilterValue(ticket) !== filters.source) {
      return false;
    }
    if (filters.category && (ticket.category_name_da ?? "") !== filters.category) {
      return false;
    }
    if (filters.status && ticket.status !== filters.status) {
      return false;
    }
    if (filters.priority && ticket.priority !== filters.priority) {
      return false;
    }
    if (filters.sla === "breached" && !ticket.sla_breached) {
      return false;
    }
    if (filters.sla === "ok" && ticket.sla_breached) {
      return false;
    }
    return true;
  });
}

function compareTicketNumber(a: Ticket, b: Ticket, dir: 1 | -1): number {
  return dir * a.ticket_number.localeCompare(b.ticket_number, "da", { numeric: true });
}

function compareSla(a: Ticket, b: Ticket): number {
  const aSec = a.sla_remaining_seconds ?? (a.sla_breached ? -1 : Number.MAX_SAFE_INTEGER);
  const bSec = b.sla_remaining_seconds ?? (b.sla_breached ? -1 : Number.MAX_SAFE_INTEGER);
  return aSec - bSec;
}

export function sortServiceDeskTable(
  tickets: Ticket[],
  sort: ServiceDeskSortKey,
): Ticket[] {
  if (sort === "queue") {
    return sortServiceDeskQueue(tickets);
  }

  const sorted = [...tickets];
  switch (sort) {
    case "ticket_number_asc":
      sorted.sort((a, b) => compareTicketNumber(a, b, 1));
      break;
    case "ticket_number_desc":
      sorted.sort((a, b) => compareTicketNumber(a, b, -1));
      break;
    case "title_asc":
      sorted.sort((a, b) => a.title.localeCompare(b.title, "da"));
      break;
    case "title_desc":
      sorted.sort((a, b) => b.title.localeCompare(a.title, "da"));
      break;
    case "source_asc":
      sorted.sort((a, b) =>
        ticketSourceFilterLabel(ticketSourceFilterValue(a)).localeCompare(
          ticketSourceFilterLabel(ticketSourceFilterValue(b)),
          "da",
        ),
      );
      break;
    case "category_asc":
      sorted.sort((a, b) =>
        (a.category_name_da ?? "").localeCompare(b.category_name_da ?? "", "da"),
      );
      break;
    case "status_asc":
      sorted.sort((a, b) => a.status.localeCompare(b.status, "da"));
      break;
    case "priority_asc":
      sorted.sort(
        (a, b) =>
          (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9),
      );
      break;
    case "priority_desc":
      sorted.sort(
        (a, b) =>
          (PRIORITY_RANK[b.priority] ?? 9) - (PRIORITY_RANK[a.priority] ?? 9),
      );
      break;
    case "sla_asc":
      sorted.sort(compareSla);
      break;
    case "sla_desc":
      sorted.sort((a, b) => -compareSla(a, b));
      break;
    case "created_asc":
      sorted.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      break;
    case "created_desc":
      sorted.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      break;
    default:
      return sortServiceDeskQueue(tickets);
  }
  return sorted;
}

export function hasActiveServiceDeskTableFilters(
  filters: ServiceDeskTableFilters,
): boolean {
  return (
    filters.sort !== DEFAULT_SERVICE_DESK_TABLE_FILTERS.sort ||
    Boolean(filters.tag) ||
    Boolean(filters.source) ||
    Boolean(filters.category) ||
    Boolean(filters.status) ||
    Boolean(filters.priority) ||
    Boolean(filters.sla)
  );
}
