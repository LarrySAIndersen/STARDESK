import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PortalCommentForm } from "@/components/portal/ticket/comment-form";
import { CommentThread } from "@/components/portal/ticket/comment-thread";
import { PortalTicketAttachments } from "@/components/portal/ticket/portal-ticket-attachments";
import { RelatedArticles } from "@/components/portal/ticket/related-articles";
import { StatusTimeline } from "@/components/portal/ticket/status-timeline";
import { TicketDetailsSidebar } from "@/components/portal/ticket/ticket-details-sidebar";
import { TicketHeader } from "@/components/portal/ticket/ticket-header";
import { ApiError } from "@/lib/api";
import { apiGetServer } from "@/lib/api-server";
import { getServerUser } from "@/lib/auth-server";
import { isStaff } from "@/lib/auth";
import { relatedArticlesForTicket } from "@/lib/portal-ticket-related";
import { canAccessPortalKnowledge } from "@/lib/portal-access";
import type { KnowledgeArticle } from "@/types/knowledge-article";
import type { TicketDetail } from "@/types/ticket";

export const dynamic = "force-dynamic";

export default async function PortalV2TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentUser = await getServerUser();
  if (!currentUser) {
    redirect("/login");
  }

  if (isStaff(currentUser)) {
    redirect(`/tickets/${id}`);
  }

  try {
    const ticket = await apiGetServer<TicketDetail>(`/api/v1/tickets/${id}`);

    let relatedArticles: KnowledgeArticle[] = [];
    if (canAccessPortalKnowledge(currentUser)) {
      try {
        const articles = await apiGetServer<KnowledgeArticle[]>(
          "/api/v1/knowledge-articles?portal=true&limit=100",
        );
        relatedArticles = relatedArticlesForTicket(ticket, articles);
      } catch {
        relatedArticles = [];
      }
    }

    return (
      <div className="portal-v2-page mx-auto w-full max-w-6xl space-y-6 p-4 pb-10 sm:p-6">
        <TicketHeader ticket={ticket} />

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
                <p className="text-[var(--gray-mid)] text-[13px]">Ingen beskrivelse angivet.</p>
              )}
            </section>

            <section className="portal-v2-card p-4 sm:p-5">
              <h2 className="portal-v2-section-title mb-1">Beskeder</h2>
              <p className="text-[var(--gray-mid)] mb-4 text-[12px]">
                Kun beskeder synlige for dig — interne noter vises ikke.
              </p>
              <CommentThread ticketId={ticket.id} comments={ticket.comments} />
            </section>

            <PortalTicketAttachments attachments={ticket.attachments} />

            <section className="portal-v2-card p-4 sm:p-5">
              <h2 className="portal-v2-section-title mb-3">Skriv til sagsbehandling</h2>
              <PortalCommentForm ticketId={ticket.id} />
            </section>
          </div>

          <div className="space-y-4 lg:col-span-1">
            <TicketDetailsSidebar ticket={ticket} />
            <RelatedArticles articles={relatedArticles} />
          </div>
        </div>

        <p className="text-center">
          <Link
            href={`/tickets/${ticket.id}`}
            className="text-[var(--gray-mid)] text-[11px] hover:text-star-navy"
          >
            Se klassisk sagvisning
          </Link>
        </p>
      </div>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    if (error instanceof ApiError && error.status === 403) {
      return (
        <div className="portal-v2-page mx-auto max-w-lg p-6">
          <h1 className="text-star-navy text-lg font-bold">Ingen adgang</h1>
          <p className="text-[var(--gray-mid)] mt-2 text-sm">
            Du har ikke adgang til denne sag. Kun indmelder eller brugere i samme organisation kan
            se sagen.
          </p>
          <Link href="/portal" className="text-star-red mt-4 inline-block text-sm font-semibold">
            Tilbage til oversigt
          </Link>
        </div>
      );
    }
    throw error;
  }
}
