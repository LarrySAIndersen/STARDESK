import type { ReactNode } from "react";

import { PortalCommentForm } from "@/components/portal/ticket/comment-form";
import { CommentForm } from "@/components/comment-form";
import { CommentThread } from "@/components/portal/ticket/comment-thread";
import { PortalTicketAttachments } from "@/components/portal/ticket/portal-ticket-attachments";
import { StatusTimeline } from "@/components/portal/ticket/status-timeline";
import { TicketDetailsSidebar } from "@/components/portal/ticket/ticket-details-sidebar";
import { TicketHeader } from "@/components/portal/ticket/ticket-header";
import { TicketCaseAttachments } from "@/components/ticket/ticket-case-attachments";
import type { TicketDetail } from "@/types/ticket";

export type TicketCaseLayoutProps = {
  ticket: TicketDetail;
  staffView?: boolean;
  breadcrumb?: ReactNode;
  sidebarExtra?: ReactNode;
  below?: ReactNode;
  showCommentForm?: boolean;
};

export function TicketCaseLayout({
  ticket,
  staffView = false,
  breadcrumb,
  sidebarExtra,
  below,
  showCommentForm = true,
}: TicketCaseLayoutProps) {
  const commentAnchorId = staffView ? "ticket-comment-form" : "portal-comment-form";

  return (
    <div className="portal-v2-page mx-auto w-full max-w-6xl space-y-6 p-4 pb-10 sm:p-6">
      <TicketHeader
        ticket={ticket}
        breadcrumb={breadcrumb}
        commentFormId={commentAnchorId}
      />

      <section className="portal-v2-card p-4 sm:p-5" aria-label="Statusforløb">
        <StatusTimeline ticket={ticket} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="portal-v2-card p-4 sm:p-5">
            <h2 className="portal-v2-section-title mb-3">Beskrivelse</h2>
            {ticket.description?.trim() ? (
              <p className="text-[14px] leading-relaxed whitespace-pre-wrap">
                {ticket.description}
              </p>
            ) : (
              <p className="text-muted-foreground text-[13px]">Ingen beskrivelse angivet.</p>
            )}
          </section>

          <section className="portal-v2-card p-4 sm:p-5">
            <h2 className="portal-v2-section-title mb-1">Beskeder</h2>
            <p className="text-muted-foreground mb-4 text-[12px]">
              {staffView
                ? "Alle kommentarer og interne noter — nyeste nederst."
                : "Kun beskeder synlige for dig — interne noter vises ikke."}
            </p>
            <CommentThread
              ticketId={ticket.id}
              comments={ticket.comments}
              staffView={staffView}
            />
          </section>

          {staffView ? (
            <TicketCaseAttachments
              ticketId={ticket.id}
              attachments={ticket.attachments ?? []}
              staffView
            />
          ) : (
            <PortalTicketAttachments attachments={ticket.attachments ?? []} />
          )}

          {showCommentForm ? (
            <section className="portal-v2-card p-4 sm:p-5">
              <h2 className="portal-v2-section-title mb-3">
                {staffView ? "Ny kommentar" : "Skriv til sagsbehandling"}
              </h2>
              {staffView ? (
                <div id={commentAnchorId} className="scroll-mt-6">
                  <CommentForm
                    ticketId={ticket.id}
                    staffMode
                    primaryNavy
                    canBroadcastToChildren={Boolean(
                      ticket.is_major && !ticket.parent_ticket_id,
                    )}
                    childCount={ticket.children?.length ?? ticket.child_count ?? 0}
                  />
                </div>
              ) : (
                <PortalCommentForm ticketId={ticket.id} />
              )}
            </section>
          ) : null}
        </div>

        <div className="space-y-4 lg:col-span-1">
          <TicketDetailsSidebar ticket={ticket} />
          {sidebarExtra}
        </div>
      </div>

      {below ? <div className="ticket-case-below space-y-6 border-t border-border pt-8">{below}</div> : null}
    </div>
  );
}
