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
