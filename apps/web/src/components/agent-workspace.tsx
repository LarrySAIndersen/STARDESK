import { AgentDispatchBoard } from "@/components/agent-dispatch-board";
import { AgentOperationsDashboard } from "@/components/agent-operations-dashboard";
import { PageHero } from "@/components/page-hero";
import { StarSectionCard } from "@/components/star/section-card";
import { ItilTicketTable } from "@/components/itil-ticket-table";
import { apiGetServer } from "@/lib/api-server";
import type { OperationsDashboard } from "@/types/dashboard";
import type { Team } from "@/types/team";
import type { Ticket } from "@/types/ticket";

export async function AgentWorkspace() {
  let dashboard: OperationsDashboard | null = null;
  let tickets: Ticket[] = [];
  let teams: Team[] = [];
  let majorOpen: Ticket[] = [];
  let fetchError: string | null = null;

  try {
    const [dashboardData, boardTickets, teamList, major] = await Promise.all([
      apiGetServer<OperationsDashboard>("/api/v1/reports/dashboard"),
      apiGetServer<Ticket[]>("/api/v1/tickets?board=true&limit=500"),
      apiGetServer<Team[]>("/api/v1/teams", { revalidate: 120 }),
      apiGetServer<Ticket[]>("/api/v1/tickets?major_open=true&limit=50"),
    ]);
    dashboard = dashboardData;
    tickets = boardTickets;
    teams = teamList;
    majorOpen = major;
  } catch {
    fetchError = "Kunne ikke hente data fra API. Tjek at backend kører.";
  }

  return (
    <div className="space-y-10">
      <section
        id="operations-dashboard"
        aria-label="Driftsdashboard"
        className="star-section-card star-section-card--accent overflow-hidden"
      >
        <div className="star-section-header border-b-0 pb-0">
          <PageHero
            title="Driftsdashboard"
            lead="Nøgletal, sagspipeline og SLA — samme ITSM-logik som standardrapporter."
          />
        </div>
        <div className="star-section-body pt-2">
          {dashboard ? (
            <AgentOperationsDashboard dashboard={dashboard} />
          ) : (
            <p className="text-muted-foreground text-sm">Dashboarddata er ikke tilgængelig.</p>
          )}
        </div>
      </section>

      <section
        id="agent-workspace"
        aria-label="Arbejdsområde"
        className="border-border space-y-10 border-t pt-8"
      >
        {fetchError ? (
          <p className="text-star-red text-sm" role="alert">
            {fetchError}
          </p>
        ) : null}

        {majorOpen.length > 0 ? (
          <StarSectionCard
            variant="accent"
            title="Åbne store sager"
            description="Kræver særlig opmærksomhed — markeret med Stor sag i oversigten."
          >
            <ItilTicketTable tickets={majorOpen} compact />
          </StarSectionCard>
        ) : null}

        <section id="dispatch-board" aria-label="Sagstildeling">
          <StarSectionCard
            title="Sagstildeling"
            description="Træk sager til grupper eller brug knappen Tildel til gruppe."
          >
            {fetchError ? null : <AgentDispatchBoard tickets={tickets} teams={teams} />}
          </StarSectionCard>
        </section>
      </section>
    </div>
  );
}
