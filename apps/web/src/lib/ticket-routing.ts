import type { Ticket, TicketRouting } from "@/types/ticket";
import type { Team } from "@/types/team";

/** Assignment match score for drag-drop (uses API routing when present). */
export function routingConfidenceForAssign(
  ticket: Ticket,
  memberKey: string,
  teams: Team[],
): number {
  const routing = ticket.routing;
  if (routing?.suggested_team_id && routing.routing_confidence != null) {
    const memberTeam = teams
      .flatMap((t) => t.members.map((m) => ({ teamId: t.id, userId: m.user_id })))
      .find((m) => m.userId === memberKey);
    if (memberTeam?.teamId === routing.suggested_team_id) {
      return routing.routing_confidence;
    }
    return Math.max(25, routing.routing_confidence - 35);
  }
  let hash = 0;
  const s = `${ticket.id}:${memberKey}`;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) % 9973;
  }
  return 25 + (hash % 71);
}

export function routingReadinessMessage(routing: TicketRouting): string {
  const missing = routing.missing_fields_da.join(", ");
  return `Auto-tildeling afventer: mangler ${missing}`;
}

export function firstUnassignedWithRouting(tickets: Ticket[]): Ticket | null {
  return (
    tickets.find(
      (t) =>
        !t.assigned_team_id &&
        !["closed", "cancelled", "resolved"].includes(t.status) &&
        t.routing?.suggested_team_name,
    ) ?? null
  );
}
