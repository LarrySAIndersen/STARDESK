"use client";

import { CommentForm } from "@/components/comment-form";
import { TicketImageStrip } from "@/components/ticket/ticket-image-strip";
import {
  CollapsibleCommentComposer,
  TicketTopBandComments,
} from "@/components/ticket/ticket-top-band-comments";
import { usePendingImageAttachments } from "@/components/pending-image-attachments";
import type { TicketDetail } from "@/types/ticket";

export function TicketDetailTopBandCenter({
  ticket,
  staffView,
}: {
  ticket: TicketDetail;
  staffView: boolean;
}) {
  const { files, addFiles, onPaste, removeAt, clear, hasFiles } = usePendingImageAttachments();

  const imageStrip = (
    <TicketImageStrip
      ticketId={ticket.id}
      attachments={ticket.attachments ?? []}
      pendingFiles={files}
      onAddFiles={addFiles}
      onRemovePending={removeAt}
      staffView={staffView}
    />
  );

  return (
    <section className="wire-card mb-0 flex min-h-0 flex-col">
      <h2 className="wire-card-title">Fejlbeskrivelse</h2>
      <p className="text-star-navy mt-2 max-h-[min(5.5rem,16vh)] overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap">
        {ticket.description?.trim() ? ticket.description : "—"}
      </p>

      <div className="mt-4 min-h-0 flex-1">
        <TicketTopBandComments
          ticketId={ticket.id}
          comments={ticket.comments}
          staffView={staffView}
        />
      </div>

      <div className="mt-4 shrink-0">{imageStrip}</div>

      <CollapsibleCommentComposer
        commentForm={
          <CommentForm
            ticketId={ticket.id}
            staffMode={staffView}
            primaryNavy
            canBroadcastToChildren={Boolean(
              ticket.is_major && !ticket.parent_ticket_id,
            )}
            childCount={ticket.children?.length ?? ticket.child_count ?? 0}
            onPaste={onPaste}
            hidePendingPreview
            compact
            externalPending={{ files, hasFiles, clear }}
            onSubmitted={clear}
          />
        }
      />
    </section>
  );
}
