import { AgentDashboardClient } from "@/components/agent-dashboard-client";
import { AgentOperationsHome } from "@/components/agent-operations-home";
import { ApiError } from "@/lib/api";
import { apiGetServer } from "@/lib/api-server";
import { canManageUsers } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";
import type { DashboardScope } from "@/lib/dashboard-ticket-links";
import type { OperationsDashboard } from "@/types/dashboard";
import type { Team } from "@/types/team";
import type { Ticket } from "@/types/ticket";
import type { User } from "@/types/user";

function defaultScopeForUser(user: User | null): DashboardScope {
  return canManageUsers(user) ? "all" : "personal";
}

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

export async function AgentWorkspace() {
  let dashboard: OperationsDashboard | null = null;
  let tickets: Ticket[] = [];
  let teams: Team[] = [];
  let fetchError: string | null = null;

  const currentUser = await getServerUser();
  const initialScope = defaultScopeForUser(currentUser);

  try {
    const [dashboardData, boardTickets, teamList] = await Promise.all([
      apiGetServer<OperationsDashboard>(
        `/api/v1/reports/dashboard?scope=${encodeURIComponent(initialScope)}`,
      ),
      apiGetServer<Ticket[]>("/api/v1/tickets?board=true&limit=500"),
      apiGetServer<Team[]>("/api/v1/teams"),
    ]);
    dashboard = dashboardData;
    tickets = boardTickets;
    teams = teamList;
  } catch (error) {
    fetchError = formatWorkspaceFetchError(error);
  }

  if (fetchError) {
    return (
      <p className="text-star-red px-5 py-4 text-sm" role="alert">
        {fetchError}
      </p>
    );
  }

  if (!dashboard) {
    return (
      <p className="text-[var(--gray-mid)] px-5 py-4 text-sm">
        Dashboarddata er ikke tilgængelig.
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AgentOperationsHome
        initialDashboard={dashboard}
        initialScope={initialScope}
        user={currentUser}
      />
      <AgentDashboardClient tickets={tickets} teams={teams} />
    </div>
  );
}
