import { CommentThread } from "@/components/portal/ticket/comment-thread";
import { TicketCaseImageList } from "@/components/ticket/ticket-case-image-list";
import type { Attachment } from "@/types/attachment";
import type { Comment } from "@/types/comment";

export function TicketCaseMessagesPanel({
  ticketId,
  ticketNumber,
  comments,
  attachments,
  staffView = false,
}: {
  ticketId: string;
  ticketNumber: string;
  comments: Comment[];
  attachments: Attachment[];
  staffView?: boolean;
}) {
  return (
    <>
      <section className="portal-v2-card p-4 sm:p-5" aria-labelledby="case-messages-heading">
        <h2 id="case-messages-heading" className="portal-v2-section-title mb-1">
          Beskeder
        </h2>
        <p className="text-muted-foreground mb-4 text-[12px]">
          {staffView
            ? "Tekstkommentarer og interne noter — nyeste nederst."
            : "Kun beskeder synlige for dig — interne noter vises ikke."}
        </p>
        <CommentThread ticketId={ticketId} comments={comments} staffView={staffView} />
      </section>

      <section className="portal-v2-card p-4 sm:p-5" aria-labelledby="case-images-heading">
        <h2 id="case-images-heading" className="portal-v2-section-title mb-1">
          Billeder og filer
        </h2>
        <p className="text-muted-foreground mb-3 text-[12px]">
          {staffView
            ? "Alle vedhæftninger på sagen — navngivet med sagsnummer og tidspunkt."
            : "Filer gennemgår virusscan. Godkendte filer kan åbnes her."}
        </p>
        <TicketCaseImageList
          ticketId={ticketId}
          ticketNumber={ticketNumber}
          attachments={attachments}
          staffView={staffView}
        />
      </section>
    </>
  );
}
