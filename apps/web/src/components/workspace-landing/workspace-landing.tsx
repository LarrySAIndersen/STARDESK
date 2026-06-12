import { Suspense } from "react";

import { AgentMainLoading } from "@/components/agent/agent-main-loading";
import { WorkspaceLandingClient } from "@/components/workspace-landing/workspace-landing-client";
import { ApiError } from "@/lib/api";
import { apiGetServer } from "@/lib/api-server";
import { getServerUser } from "@/lib/auth-server";
import type { UserTicketsGrouped } from "@/types/admin-user";
import type { OperationsDashboard } from "@/types/dashboard";
import type { PersonalKanban, PersonalNote } from "@/types/personal";
import type { Team } from "@/types/team";
import type { Ticket } from "@/types/ticket";

function formatWorkspaceFetchError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Din session er udløbet. Log ind igen.";
    }
    if (error.status === 403) {
      return "Du har ikke adgang til at hente dashboard-data.";
    }
    return `Kunne ikke hente data fra API (${error.status}): ${error.message}`;
  }
  if (error instanceof Error && error.name === "TimeoutError") {
    return "API svarer ikke i tide. Tjek at backend kører og at NEXT_PUBLIC_API_URL er korrekt.";
  }
  return "Kunne ikke hente data fra API. Tjek at backend kører.";
}

export async function WorkspaceLanding() {
  const user = await getServerUser();
  if (!user) {
    return null;
  }

  let notesLoadFailed = false;
  const notesPromise = apiGetServer<PersonalNote[]>("/api/v1/personal/notes").catch(() => {
    notesLoadFailed = true;
    return [] as PersonalNote[];
  });

  try {
    const [
      personalDashboard,
      teamDashboard,
      tickets,
      teams,
      notes,
      kanban,
      userTickets,
    ] = await Promise.all([
      apiGetServer<OperationsDashboard>("/api/v1/reports/dashboard?scope=personal"),
      apiGetServer<OperationsDashboard>("/api/v1/reports/dashboard?scope=group"),
      apiGetServer<Ticket[]>("/api/v1/tickets?board=true&limit=500"),
      apiGetServer<Team[]>("/api/v1/teams"),
      notesPromise,
      apiGetServer<PersonalKanban>("/api/v1/personal/kanban").catch(
        () =>
          ({
            columns: ["Min kø", "I gang", "Færdig"],
            cards: [],
            tickets: [],
          }) satisfies PersonalKanban,
      ),
      apiGetServer<UserTicketsGrouped>(`/api/v1/users/${user.id}/tickets?limit=50`).catch(
        () =>
          ({
            reported: [],
            assigned: [],
            affected: [],
            interested: [],
            mentioned: [],
          }) satisfies UserTicketsGrouped,
      ),
    ]);

    const assignableTickets = [
      ...userTickets.assigned,
      ...userTickets.reported.filter((t) => !userTickets.assigned.some((a) => a.id === t.id)),
    ];

    return (
      <Suspense fallback={<AgentMainLoading />}>
        <WorkspaceLandingClient
          user={user}
          personalDashboard={personalDashboard}
          teamDashboard={teamDashboard}
          tickets={tickets}
          teams={teams}
          initialNotes={notes}
          initialKanban={kanban}
          userTickets={userTickets}
          assignableTickets={assignableTickets}
          notesLoadFailed={notesLoadFailed}
        />
      </Suspense>
    );
  } catch (error) {
    return (
      <p className="text-star-red px-5 py-4 text-sm" role="alert">
        {formatWorkspaceFetchError(error)}
      </p>
    );
  }
}
