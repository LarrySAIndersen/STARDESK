/** Aligns with API/dashboard OPEN_STATUSES (excludes resolved). */
export const OPEN_TICKET_STATUSES = [
  "new",
  "assigned",
  "in_progress",
  "on_hold",
] as const;

export function isOpenTicketStatus(status: string): boolean {
  return (OPEN_TICKET_STATUSES as readonly string[]).includes(status);
}
