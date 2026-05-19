import { AdminGroupsPanel } from "@/components/admin-groups-panel";
import { GroupsTeamSections } from "@/components/groups-team-sections";
import { ApiError } from "@/lib/api";
import { apiGetServer } from "@/lib/api-server";
import { isAdmin, isStaff } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";
import { sortTeamsForDisplay } from "@/lib/team-categories";
import { redirect } from "next/navigation";
import type { Team } from "@/types/team";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const currentUser = await getServerUser();

  if (!isStaff(currentUser)) {
    redirect("/");
  }

  let teams: Team[] = [];
  let error: string | null = null;
  try {
    teams = await apiGetServer<Team[]>("/api/v1/teams");
  } catch (err) {
    if (err instanceof ApiError) {
      error = err.message;
    } else {
      error = "Kunne ikke hente grupper";
    }
  }

  const sortedTeams = sortTeamsForDisplay(teams);
  const adminView = isAdmin(currentUser);

  return (
    <div className="wire-scroll-content min-h-0 flex-1 space-y-6">
      <p className="text-muted-foreground max-w-2xl text-sm">
        {adminView
          ? "SF er hovedgruppe for alle agenter. Undergrupper (Virksomhed, North Star m.fl.) modtager sager for deres organisation. Administratorer kan redigere medlemmer."
          : "SF er hovedgruppe for alle agenter. Undergrupper modtager sager for deres organisation."}
      </p>

      {adminView ? (
        <AdminGroupsPanel initialTeams={sortedTeams} initialError={error} />
      ) : error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : sortedTeams.length === 0 ? (
        <p className="text-muted-foreground text-sm">Ingen grupper fundet.</p>
      ) : (
        <GroupsTeamSections teams={sortedTeams} />
      )}
    </div>
  );
}
