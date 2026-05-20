import type { Ticket, TicketDetail } from "@/types/ticket";

/** Felter fra assignment-API der skal spejles i board/list-visninger. */
export type TicketAssignmentFields = Pick<
  TicketDetail,
  | "assigned_team_id"
  | "assigned_team_name"
  | "assigned_user_id"
  | "assigned_user_name"
  | "status"
  | "assignment_reason"
  | "fault_displayed"
>;

/** Opdater ét ticket-objekt med tildeling returneret fra API (DB er sandhed). */
export function mergeTicketAssignmentFromDetail(
  ticket: Ticket,
  detail: TicketAssignmentFields,
): Ticket {
  return {
    ...ticket,
    assigned_team_id: detail.assigned_team_id,
    assigned_team_name: detail.assigned_team_name,
    assigned_user_id: detail.assigned_user_id,
    assigned_user_name: detail.assigned_user_name,
    status: detail.status,
    assignment_reason: detail.assignment_reason ?? ticket.assignment_reason,
    fault_displayed: detail.fault_displayed ?? ticket.fault_displayed,
  };
}

export function mergeTicketAssignmentInList(
  tickets: Ticket[],
  ticketId: string,
  detail: TicketAssignmentFields,
): Ticket[] {
  return tickets.map((ticket) =>
    ticket.id === ticketId ? mergeTicketAssignmentFromDetail(ticket, detail) : ticket,
  );
}

/**
 * Efter router.refresh kan server-props være et øjeblik bagud.
 * Bevar nyere lokal tildeling indtil API og server er synkroniseret.
 */
export function reconcileLocalTicketsWithServer(
  local: Ticket[],
  server: Ticket[],
): Ticket[] {
  const localById = new Map(local.map((ticket) => [ticket.id, ticket]));
  return server.map((serverTicket) => {
    const localTicket = localById.get(serverTicket.id);
    if (!localTicket) {
      return serverTicket;
    }
    const localTeam = localTicket.assigned_team_id ?? null;
    const serverTeam = serverTicket.assigned_team_id ?? null;
    if (localTeam && localTeam !== serverTeam) {
      return mergeTicketAssignmentFromDetail(serverTicket, {
        assigned_team_id: localTicket.assigned_team_id ?? null,
        assigned_team_name: localTicket.assigned_team_name ?? null,
        assigned_user_id: localTicket.assigned_user_id ?? null,
        assigned_user_name: localTicket.assigned_user_name ?? null,
        status: localTicket.status,
        assignment_reason: localTicket.assignment_reason ?? null,
        fault_displayed: localTicket.fault_displayed,
      });
    }
    return serverTicket;
  });
}
