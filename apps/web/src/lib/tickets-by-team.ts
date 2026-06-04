import type { Ticket } from "@/types/ticket";

/** Normalized map key so team.id and ticket.assigned_team_id always match. */
export function teamIdMapKey(teamId: string): string {
  return teamId.toLowerCase();
}

export function buildTicketsByTeamMap(tickets: Iterable<Ticket>): Map<string, Ticket[]> {
  const map = new Map<string, Ticket[]>();
  for (const ticket of tickets) {
    const key = ticket.assigned_team_id
      ? teamIdMapKey(ticket.assigned_team_id)
      : null;
    if (!key) {
      continue;
    }
    const list = map.get(key) ?? [];
    list.push(ticket);
    map.set(key, list);
  }
  for (const [teamId, list] of map) {
    list.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    map.set(teamId, list);
  }
  return map;
}

export function getTicketsForTeam(
  map: Map<string, Ticket[]>,
  teamId: string,
): Ticket[] {
  return map.get(teamIdMapKey(teamId)) ?? [];
}
