"use client";

import { usePendingImageAttachments } from "@/components/pending-image-attachments";
import { TicketImageStrip } from "@/components/ticket/ticket-image-strip";
import type { Attachment } from "@/types/attachment";

export function TicketCaseImageStripSection({
  ticketId,
  attachments,
  staffView,
}: {
  ticketId: string;
  attachments: Attachment[];
  staffView: boolean;
}) {
  const { files, addFiles, removeAt } = usePendingImageAttachments();

  return (
    <TicketImageStrip
      ticketId={ticketId}
      attachments={attachments}
      pendingFiles={files}
      onAddFiles={addFiles}
      onRemovePending={removeAt}
      staffView={staffView}
    />
  );
}
