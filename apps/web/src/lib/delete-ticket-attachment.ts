import { apiDelete } from "@/lib/api";

export async function deleteTicketAttachment(
  ticketId: string,
  attachmentId: string,
): Promise<void> {
  await apiDelete(`/api/v1/tickets/${ticketId}/attachments/${attachmentId}`);
}
