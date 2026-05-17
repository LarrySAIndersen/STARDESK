import { AgentDispatchBoard } from "@/components/agent-dispatch-board";
import { StarSectionCard } from "@/components/star/section-card";
import { ItilTicketTable } from "@/components/itil-ticket-table";
import { apiGetServer } from "@/lib/api-server";
import type { Team } from "@/types/team";
import type { Ticket } from "@/types/ticket";
import type { User } from "@/types/user";

export async function AgentWorkspace(_props: { currentUser: User | null }) {
  let tickets: Ticket[] = [];
  let teams: Team[] = [];
  let majorOpen: Ticket[] = [];
  let fetchError: string | null = null;

  try {
    const [boardTickets, teamList, major] = await Promise.all([
      apiGetServer<Ticket[]>("/api/v1/tickets?board=true"),
      apiGetServer<Team[]>("/api/v1/teams"),
      apiGetServer<Ticket[]>("/api/v1/tickets?major_open=true"),
    ]);
    tickets = boardTickets;
    teams = teamList;
    majorOpen = major;
  } catch {
    fetchError = "Kunne ikke hente sager fra API. Tjek at backend kører.";
  }

  return (
    <div className="space-y-8">
      {majorOpen.length > 0 ? (
        <StarSectionCard
          variant="accent"
          title="Åbne store sager"
          description="Kræver særlig opmærksomhed — markeret med Stor sag i oversigten."
        >
          <ItilTicketTable tickets={majorOpen} compact />
        </StarSectionCard>
      ) : null}

      {fetchError ? (
        <p className="text-star-red text-sm">{fetchError}</p>
      ) : (
        <AgentDispatchBoard tickets={tickets} teams={teams} />
      )}
    </div>
  );
}
