import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { RelatedArticles } from "@/components/portal/ticket/related-articles";
import { TicketCaseLayout } from "@/components/ticket/ticket-case-layout";
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
      <>
        <TicketCaseLayout
          ticket={ticket}
          sidebarExtra={<RelatedArticles articles={relatedArticles} />}
        />
        <p className="portal-v2-page mx-auto max-w-6xl pb-10 text-center">
          <Link
            href={`/tickets/${ticket.id}`}
            className="text-muted-foreground text-[11px] hover:text-primary"
          >
            Se klassisk sagvisning
          </Link>
        </p>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    if (error instanceof ApiError && error.status === 403) {
      return (
        <div className="portal-v2-page mx-auto max-w-lg p-6">
          <h1 className="text-foreground text-lg font-bold">Ingen adgang</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Du har ikke adgang til denne sag. Kun indmelder eller brugere i samme organisation kan
            se sagen.
          </p>
          <Link href="/portal" className="text-primary mt-4 inline-block text-sm font-semibold">
            Tilbage til oversigt
          </Link>
        </div>
      );
    }
    throw error;
  }
}
