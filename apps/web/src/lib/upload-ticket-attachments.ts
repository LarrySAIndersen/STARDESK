import { apiPostForm } from "@/lib/api";
import type { Attachment } from "@/types/attachment";

export async function uploadTicketAttachments(
  ticketId: string,
  files: File[],
): Promise<Attachment[]> {
  const uploaded: Attachment[] = [];
  for (const file of files) {
    const formData = new FormData();
    formData.append("file", file);
    const row = await apiPostForm<Attachment>(
      `/api/v1/tickets/${ticketId}/attachments`,
      formData,
    );
    uploaded.push(row);
  }
  return uploaded;
}
