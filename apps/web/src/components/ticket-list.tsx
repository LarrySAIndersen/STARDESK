import { AgentWorkspace } from "@/components/agent-workspace";
import { MajorTicketsBoard } from "@/components/major-tickets-board";
import { StarSectionCard } from "@/components/star/section-card";
import { StarLinkArrow } from "@/components/star/link-arrow";
import { ItilTicketTable } from "@/components/itil-ticket-table";
import { apiGetServer } from "@/lib/api-server";
import { isStaff, USER_COOKIE } from "@/lib/auth";
import type { Ticket } from "@/types/ticket";
import type { User } from "@/types/user";
import { cookies } from "next/headers";

export async function TicketList() {
  let tickets: Ticket[] = [];
  let fetchError: string | null = null;
  let currentUser: User | null = null;

  const userCookie = (await cookies()).get(USER_COOKIE)?.value;
  if (userCookie) {
    try {
      currentUser = JSON.parse(decodeURIComponent(userCookie)) as User;
    } catch {
      currentUser = null;
    }
  }

  if (isStaff(currentUser)) {
    return <AgentWorkspace currentUser={currentUser} />;
  }

  try {
    tickets = await apiGetServer<Ticket[]>("/api/v1/tickets");
  } catch {
    fetchError = "Kunne ikke hente sager fra API. Tjek at backend kører.";
  }

  const regularTickets = tickets.filter((ticket) => !ticket.is_major);
  const listSubtitle = fetchError
    ? "Forbindelse til API mislykkedes"
    : currentUser?.organization_name
      ? `${regularTickets.length} sag${regularTickets.length === 1 ? "" : "er"} i ${currentUser.organization_name}`
      : `${regularTickets.length} sag${regularTickets.length === 1 ? "" : "er"}`;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_minmax(300px,380px)]">
      <StarSectionCard variant="navy" title="Dine sager" description={listSubtitle}>
        {fetchError ? (
          <p className="text-star-red text-sm">{fetchError}</p>
        ) : regularTickets.length === 0 ? (
          <p className="text-muted-foreground text-sm">Ingen sager endnu.</p>
        ) : (
          <ItilTicketTable tickets={regularTickets} />
        )}
        <div className="mt-6 border-t pt-4">
          <StarLinkArrow href="/tickets/new">Opret ny sag</StarLinkArrow>
        </div>
      </StarSectionCard>

      <MajorTicketsBoard tickets={tickets} />
    </div>
  );
}
