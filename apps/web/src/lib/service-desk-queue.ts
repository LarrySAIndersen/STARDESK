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
      .map((t) => t.id.toLowerCase()),
  );
}

function isAssignedToDeskTeam(ticket: Ticket, deskTeamIds?: Set<string>): boolean {
  const teamId = ticket.assigned_team_id?.toLowerCase();
  if (!teamId) {
    return false;
  }
  if (deskTeamIds && deskTeamIds.size > 0) {
    return deskTeamIds.has(teamId);
  }
  const name = ticket.assigned_team_name?.trim() ?? "";
  return name === SERVICE_DESK_TEAM_NAME || name === "Service Desk";
}

/**
 * Distribution queue (Seneste sager / I service desk):
 * - Tickets without an assigned team ("uden gruppe"), OR
 * - Tickets with status "new" (freshly created, regardless of pre-assigned team).
 *
 * Once a ticket moves out of "new" and is assigned to a non-desk team, it leaves the queue.
 */
export function isInServiceDeskQueue(ticket: Ticket, deskTeamIds?: Set<string>): boolean {
  if (ticket.status === "new") {
    return true;
  }
  if (!ticket.assigned_team_id) {
    return true;
  }
  return isAssignedToDeskTeam(ticket, deskTeamIds);
}

/** Dashboard / desk distribution: open tickets still in the desk queue. */
export function isAssignableFromServiceDeskQueue(
  ticket: Ticket,
  deskTeamIds?: Set<string>,
): boolean {
  if (["closed", "cancelled", "resolved"].includes(ticket.status)) {
    return false;
  }
  return isInServiceDeskQueue(ticket, deskTeamIds);
}

/** Tildelt en operativ gruppe (vises i højre rail — ikke desk-kø). */
export function isInTeamsQueue(ticket: Ticket, deskTeamIds?: Set<string>): boolean {
  if (!ticket.assigned_team_id) {
    return false;
  }
  return !isInServiceDeskQueue(ticket, deskTeamIds);
}

/** Interne grupper der kan modtage sager i højre rail (uden SF Service Desk). */
export function teamsForServiceDeskRail(teams: Team[], deskTeamIds?: Set<string>): Team[] {
  const deskIds = deskTeamIds ?? serviceDeskTeamIds(teams);
  return teams.filter((team) => !deskIds.has(team.id.toLowerCase()));
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
