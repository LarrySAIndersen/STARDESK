import { AgentGroupsPanel } from "@/components/agent-groups-panel";
import { StarSectionCard } from "@/components/star/section-card";
import { ItilTicketTable } from "@/components/itil-ticket-table";
import { apiGetServer } from "@/lib/api-server";
import type { Ticket } from "@/types/ticket";
import type { User } from "@/types/user";

export async function AgentWorkspace({ currentUser }: { currentUser: User | null }) {
  let majorOpen: Ticket[] = [];
  let assignedQueue: Ticket[] = [];
  let fetchError: string | null = null;

  try {
    const [major, queue] = await Promise.all([
      apiGetServer<Ticket[]>("/api/v1/tickets?major_open=true"),
      apiGetServer<Ticket[]>("/api/v1/tickets"),
    ]);
    majorOpen = major;
    assignedQueue = queue;
  } catch {
    fetchError = "Kunne ikke hente sager fra API. Tjek at backend kører.";
  }

  const orgLabel = currentUser?.organization_name
    ? ` — ${currentUser.organization_name}`
    : "";

  const queueTitle =
    currentUser?.role === "admin" ? "Alle sager" : "Min kø — tildelt mig eller min gruppe";
  const queueDescription =
    currentUser?.role === "admin"
      ? `${assignedQueue.length} sag${assignedQueue.length === 1 ? "" : "er"} i systemet`
      : `${assignedQueue.length} sag${assignedQueue.length === 1 ? "" : "er"} i din kø`;

  return (
    <div className="space-y-8">
      <StarSectionCard
        variant="accent"
        title="Åbne store sager"
        description={`Vises for alle agenter${orgLabel}. Sager markeret som stor sag, der ikke er lukket.`}
      >
        {fetchError ? (
          <p className="text-star-red text-sm">{fetchError}</p>
        ) : (
          <ItilTicketTable tickets={majorOpen} compact />
        )}
      </StarSectionCard>

      <StarSectionCard variant="navy" title={queueTitle} description={fetchError ? undefined : queueDescription}>
        {fetchError ? (
          <p className="text-star-red text-sm">{fetchError}</p>
        ) : (
          <ItilTicketTable tickets={assignedQueue} />
        )}
      </StarSectionCard>

      <AgentGroupsPanel />
    </div>
  );
}
