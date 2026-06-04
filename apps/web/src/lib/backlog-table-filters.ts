import {
  applyServiceDeskTableFilters,
  DEFAULT_SERVICE_DESK_TABLE_FILTERS,
  hasActiveServiceDeskTableFilters,
  type ServiceDeskTableFilters,
} from "@/lib/service-desk-table-filters";
import type { Ticket } from "@/types/ticket";

export type BacklogAssignmentFilter = "" | "mine" | "unassigned";

export type BacklogTableFilters = ServiceDeskTableFilters & {
  assignment: BacklogAssignmentFilter;
  ticket_type: "" | "incident" | "service_request" | "problem";
};

export const DEFAULT_BACKLOG_TABLE_FILTERS: BacklogTableFilters = {
  ...DEFAULT_SERVICE_DESK_TABLE_FILTERS,
  sort: "sla_asc",
  assignment: "",
  ticket_type: "",
};

export function applyBacklogTableFilters(
  tickets: Ticket[],
  filters: BacklogTableFilters,
  currentUserId: string | undefined,
): Ticket[] {
  let result = applyServiceDeskTableFilters(tickets, filters);

  if (filters.assignment === "mine") {
    if (!currentUserId) {
      return [];
    }
    result = result.filter((t) => t.assigned_user_id === currentUserId);
  } else if (filters.assignment === "unassigned") {
    result = result.filter((t) => !t.assigned_user_id);
  }

  if (filters.ticket_type) {
    result = result.filter((t) => t.ticket_type === filters.ticket_type);
  }

  return result;
}

export function hasActiveBacklogTableFilters(filters: BacklogTableFilters): boolean {
  return (
    hasActiveServiceDeskTableFilters(filters) ||
    filters.sort !== DEFAULT_BACKLOG_TABLE_FILTERS.sort ||
    Boolean(filters.assignment) ||
    Boolean(filters.ticket_type)
  );
}
