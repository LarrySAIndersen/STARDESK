import type { Ticket } from "@/types/ticket";

export const SERVICE_DESK_TEAM_NAME = "SF Service Desk";

export type ServiceDeskQueueFilter = "all" | "desk" | "teams";

const OPEN_STATUSES = new Set([
  "new",
  "assigned",
  "in_progress",
  "on_hold",
  "resolved",
]);

const PRIORITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function isOpenTicket(ticket: Ticket): boolean {
  return !["closed", "cancelled"].includes(ticket.status);
}

/** In service desk queue: unassigned or explicitly on SF Service Desk team. */
export function isInServiceDeskQueue(ticket: Ticket): boolean {
  if (!ticket.assigned_team_id) {
    return true;
  }
  const name = ticket.assigned_team_name?.trim() ?? "";
  return name === SERVICE_DESK_TEAM_NAME || name === "Service Desk";
}

export function isInTeamsQueue(ticket: Ticket): boolean {
  if (!ticket.assigned_team_id) {
    return false;
  }
  return !isInServiceDeskQueue(ticket);
}

export function filterByServiceDeskQueue(
  tickets: Ticket[],
  queue: ServiceDeskQueueFilter,
): Ticket[] {
  const open = tickets.filter(isOpenTicket);
  if (queue === "all") {
    return open;
  }
  if (queue === "desk") {
    return open.filter(isInServiceDeskQueue);
  }
  return open.filter(isInTeamsQueue);
}

/** Undistributed desk first, then P1/P2, then oldest created_at. */
export function sortServiceDeskQueue(tickets: Ticket[]): Ticket[] {
  return [...tickets].sort((a, b) => {
    const aDesk = isInServiceDeskQueue(a) ? 0 : 1;
    const bDesk = isInServiceDeskQueue(b) ? 0 : 1;
    if (aDesk !== bDesk) {
      return aDesk - bDesk;
    }
    const pa = PRIORITY_RANK[a.priority] ?? 9;
    const pb = PRIORITY_RANK[b.priority] ?? 9;
    if (pa !== pb) {
      return pa - pb;
    }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export function paginateTickets<T>(items: T[], offset: number, pageSize: number): T[] {
  return items.slice(offset, offset + pageSize);
}
