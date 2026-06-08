"use client";

import { type ReactNode } from "react";

import { PortalCommentForm } from "@/components/portal/ticket/comment-form";
import { CommentForm } from "@/components/comment-form";
import { StatusTimeline } from "@/components/portal/ticket/status-timeline";
import { TicketDetailsEditableSidebar } from "@/components/portal/ticket/ticket-details-editable-sidebar";
import { TicketDetailsSidebar } from "@/components/portal/ticket/ticket-details-sidebar";
import { TicketHeader } from "@/components/portal/ticket/ticket-header";
import { TicketCaseMessagesPanel } from "@/components/ticket/ticket-case-messages-panel";
import type { Category } from "@/types/category";
import type { Team } from "@/types/team";
import type { TicketDetail } from "@/types/ticket";

export type TicketCaseLayoutProps = {
  ticket: TicketDetail;
  onTicketUpdated?: (ticket: TicketDetail) => void;
  staffView?: boolean;
  breadcrumb?: ReactNode;
  sidebarExtra?: ReactNode;
  below?: ReactNode | ((ticket: TicketDetail) => ReactNode);
  showCommentForm?: boolean;
  /** Staff: editable Detaljer sidebar with Gem (requires teams + categories). */
  editableDetails?: boolean;
  teams?: Team[];
  categories?: Category[];
};

export function TicketCaseLayout({
  ticket,
  onTicketUpdated,
  staffView = false,
  breadcrumb,
  sidebarExtra,
  below,
  showCommentForm = true,
  editableDetails = false,
  teams = [],
  categories = [],
}: TicketCaseLayoutProps) {
  function handleTicketUpdated(updated: TicketDetail) {
    onTicketUpdated?.(updated);
  }

  const showEditableDetails =
    editableDetails && staffView && teams.length > 0 && categories.length > 0;
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

          <TicketCaseMessagesPanel
            ticketId={ticket.id}
            ticketNumber={ticket.ticket_number}
            comments={ticket.comments}
            attachments={ticket.attachments ?? []}
            staffView={staffView}
          />

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
          {showEditableDetails ? (
            <TicketDetailsEditableSidebar
              ticket={ticket}
              teams={teams}
              categories={categories}
              onTicketUpdated={handleTicketUpdated}
            />
          ) : (
            <TicketDetailsSidebar ticket={ticket} />
          )}
          {sidebarExtra}
        </div>
      </div>

      {below ? (
        <div className="ticket-case-below space-y-6 border-t border-border pt-8">
          {typeof below === "function" ? below(ticket) : below}
        </div>
      ) : null}
    </div>
  );
}
