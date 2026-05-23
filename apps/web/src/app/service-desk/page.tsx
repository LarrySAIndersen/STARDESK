import { redirect } from "next/navigation";

import { ServiceDeskView } from "@/components/service-desk/service-desk-view";
import { apiGetServer } from "@/lib/api-server";
import { isStaff } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";
import type { Team } from "@/types/team";
import type { Ticket } from "@/types/ticket";

export const dynamic = "force-dynamic";

export default async function ServiceDeskPage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/");
  }
  if (!isStaff(user)) {
    redirect("/portal");
  }

  let tickets: Ticket[] = [];
  let teams: Team[] = [];
  let fetchError: string | null = null;
  try {
    [tickets, teams] = await Promise.all([
      apiGetServer<Ticket[]>("/api/v1/tickets?board=true&limit=500"),
      apiGetServer<Team[]>("/api/v1/teams"),
    ]);
  } catch {
    fetchError = "Kunne ikke hente sager fra API.";
    tickets = [];
    teams = [];
  }

  if (fetchError) {
    return (
      <p className="text-star-red px-5 py-4 text-sm" role="alert">
        {fetchError}
      </p>
    );
  }

  return <ServiceDeskView tickets={tickets} teams={teams} />;
}
