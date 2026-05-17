import Link from "next/link";

import { FilteredTicketTable } from "@/components/filtered-ticket-table";
import { MajorTicketsBoard } from "@/components/major-tickets-board";
import { StarSectionCard } from "@/components/star/section-card";
import { StarLinkArrow } from "@/components/star/link-arrow";
import { Badge } from "@/components/ui/badge";
import { apiGetServer } from "@/lib/api-server";
import type { Ticket } from "@/types/ticket";
import type { User } from "@/types/user";

type EndUserTicketPortalProps = {
  currentUser: User | null;
};

export async function EndUserTicketPortal({ currentUser }: EndUserTicketPortalProps) {
  let tickets: Ticket[] = [];
  let storeSager: Ticket[] = [];
  let fetchError: string | null = null;

  try {
    const [mine, majors] = await Promise.all([
      apiGetServer<Ticket[]>("/api/v1/tickets"),
      apiGetServer<Ticket[]>("/api/v1/tickets?store_sager=true"),
    ]);
    tickets = mine;
    storeSager = majors.filter((t) => t.is_major);
  } catch {
    fetchError = "Kunne ikke hente sager fra API. Tjek at backend kører.";
  }

  const regularTickets = tickets.filter((ticket) => !ticket.is_major);
  const sharedTickets = regularTickets.filter((ticket) => ticket.is_shared);
  const ownOrgOnly = regularTickets.filter((ticket) => !ticket.is_shared);

  const listSubtitle = fetchError
    ? "Forbindelse til API mislykkedes"
    : currentUser?.organization_name
      ? `${ownOrgOnly.length} sag${ownOrgOnly.length === 1 ? "" : "er"} i ${currentUser.organization_name}`
      : `${ownOrgOnly.length} sag${ownOrgOnly.length === 1 ? "" : "er"}`;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_minmax(300px,380px)]">
      <div className="space-y-8">
        <StarSectionCard variant="navy" title="Dine sager" description={listSubtitle}>
          {fetchError ? (
            <p className="text-star-red text-sm">{fetchError}</p>
          ) : ownOrgOnly.length === 0 ? (
            <p className="text-muted-foreground text-sm">Ingen sager endnu.</p>
          ) : (
            <FilteredTicketTable tickets={ownOrgOnly} />
          )}
          <div className="mt-6 border-t pt-4">
            <StarLinkArrow href="/tickets/new">Opret ny sag</StarLinkArrow>
          </div>
        </StarSectionCard>

        <StarSectionCard
          variant="accent"
          title="Delte sager"
          description={`${sharedTickets.length} delt${sharedTickets.length === 1 ? "" : "e"} sag${sharedTickets.length === 1 ? "" : "er"} på tværs af organisationer`}
        >
          {sharedTickets.length === 0 ? (
            <p className="text-muted-foreground text-sm">Ingen delte sager lige nu.</p>
          ) : (
            <ul className="space-y-2">
              {sharedTickets.map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    href={`/tickets/${ticket.id}`}
                    className="border-star-blue/20 hover:border-star-blue flex items-center justify-between gap-2 rounded-sm border bg-white p-3 text-sm"
                  >
                    <span>
                      <span className="text-star-blue font-mono text-xs">{ticket.ticket_number}</span>
                      <span className="text-star-navy ml-2 font-medium">{ticket.title}</span>
                    </span>
                    <Badge variant="outline" className="border-star-blue text-star-blue text-[10px]">
                      Delt
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </StarSectionCard>
      </div>

      <MajorTicketsBoard tickets={storeSager.length > 0 ? storeSager : tickets} />
    </div>
  );
}
