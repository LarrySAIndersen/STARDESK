import type { Ticket } from "@/types/ticket";
import type { Team } from "@/types/team";

export const SERVICE_DESK_TEAM_NAME = "SF Service Desk";

export type ServiceDeskQueueFilter = "all" | "desk" | "teams";

const PRIORITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function isOpenTicket(ticket: Ticket): boolean {
  return !["closed", "cancelled"].includes(ticket.status);
}

/** IDs for teams that count as the service-desk queue (not a distribution target). */
export function serviceDeskTeamIds(teams: Team[]): Set<string> {
  return new Set(
    teams
      .filter((t) => t.name === SERVICE_DESK_TEAM_NAME || t.name === "Service Desk")
      .map((t) => t.id),
  );
}

/**
 * Venstre tabel / service desk-kø: kun sager uden tildelt gruppe.
 * Når en sag får assigned_team_id, vises den kun under den gruppe i rail.
 */
export function isInServiceDeskQueue(ticket: Ticket, _deskTeamIds?: Set<string>): boolean {
  return !ticket.assigned_team_id;
}

/** Tildelt en gruppe (vises i højre rail, inkl. SF Service Desk). */
export function isInTeamsQueue(ticket: Ticket, _deskTeamIds?: Set<string>): boolean {
  return Boolean(ticket.assigned_team_id);
}

/** Main table: distribution queue only. */
export function ticketsForServiceDeskTable(
  tickets: Ticket[],
  deskTeamIds?: Set<string>,
): Ticket[] {
  return tickets.filter((t) => isInServiceDeskQueue(t, deskTeamIds));
}

/** Right rail: tickets assigned to internal teams (excludes desk queue). */
export function ticketsForServiceDeskTeamRail(
  tickets: Ticket[],
  deskTeamIds?: Set<string>,
): Ticket[] {
  return tickets.filter((t) => isInTeamsQueue(t, deskTeamIds));
}

export function filterByServiceDeskQueue(
  tickets: Ticket[],
  queue: ServiceDeskQueueFilter,
  deskTeamIds?: Set<string>,
): Ticket[] {
  const open = tickets.filter(isOpenTicket);
  if (queue === "all") {
    return open;
  }
  if (queue === "desk") {
    return open.filter((t) => isInServiceDeskQueue(t, deskTeamIds));
  }
  return open.filter((t) => isInTeamsQueue(t, deskTeamIds));
}

/** Undistributed desk first, then P1/P2, then oldest created_at. */
export function sortServiceDeskQueue(
  tickets: Ticket[],
  deskTeamIds?: Set<string>,
): Ticket[] {
  return [...tickets].sort((a, b) => {
    const aDesk = isInServiceDeskQueue(a, deskTeamIds) ? 0 : 1;
    const bDesk = isInServiceDeskQueue(b, deskTeamIds) ? 0 : 1;
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
