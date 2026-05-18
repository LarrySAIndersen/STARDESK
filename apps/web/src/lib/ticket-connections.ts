import type { Ticket, TicketDetail } from "@/types/ticket";

/** Whether the ticket participates in a hierarchy (store sag, parent, children, or related majors). */
export function hasTicketConnections(ticket: Ticket | TicketDetail): boolean {
  const detail = ticket as TicketDetail;
  return (
    Boolean(ticket.is_major && !ticket.parent_ticket_id) ||
    Boolean(ticket.parent_ticket_id) ||
    Boolean(ticket.parent) ||
    (detail.children?.length ?? 0) > 0 ||
    (detail.related_major_tickets?.length ?? 0) > 0
  );
}

export function ticketOverviewHref(ticketId: string): string {
  return `/tickets/${ticketId}/overview`;
}

export function majorTicketsListHref(): string {
  return "/tickets/major";
}

