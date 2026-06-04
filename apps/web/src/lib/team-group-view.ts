import { isOpenTicket } from "@/lib/service-desk-queue";
import {
  buildTicketsByTeamMap,
  getTicketsForTeam,
  teamIdMapKey,
} from "@/lib/tickets-by-team";
import type { Ticket } from "@/types/ticket";

/** Default preview count when a group is not selected. */
export const TEAM_GROUP_PREVIEW_LIMIT = 6;

/** Staff ticket detail — sagens kort (full page). */
export function ticketDetailHref(ticketId: string): string {
  return `/tickets/${ticketId}`;
}

/** All open tickets with assigned_team_id — group badge + click-to-view (system-wide). */
export function buildOpenAssignedTicketsByTeamMap(
  tickets: Iterable<Ticket>,
): Map<string, Ticket[]> {
  const assignedOpen: Ticket[] = [];
  for (const ticket of tickets) {
    if (isOpenTicket(ticket) && ticket.assigned_team_id) {
      assignedOpen.push(ticket);
    }
  }
  return buildTicketsByTeamMap(assignedOpen);
}

export function isTeamSelected(
  selectedTeamId: string | null,
  teamId: string,
): boolean {
  return (
    selectedTeamId !== null &&
    teamIdMapKey(selectedTeamId) === teamIdMapKey(teamId)
  );
}

export function toggleSelectedTeamId(
  current: string | null,
  teamId: string,
): string | null {
  return isTeamSelected(current, teamId) ? null : teamId;
}

export function resolveTeamTicketDisplay(
  map: Map<string, Ticket[]>,
  teamId: string,
  selectedTeamId: string | null,
  previewLimit = TEAM_GROUP_PREVIEW_LIMIT,
): {
  visible: Ticket[];
  total: number;
  isSelected: boolean;
  showingAll: boolean;
} {
  const all = getTicketsForTeam(map, teamId);
  const isSelected = isTeamSelected(selectedTeamId, teamId);
  const visible = isSelected ? all : all.slice(0, previewLimit);
  return {
    visible,
    total: all.length,
    isSelected,
    showingAll: isSelected && all.length > previewLimit,
  };
}
