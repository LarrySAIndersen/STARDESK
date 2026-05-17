import { AdminGroupsPanel } from "@/components/admin-groups-panel";
import { GroupsTeamSections } from "@/components/groups-team-sections";
import { PageHero } from "@/components/page-hero";
import { ApiError } from "@/lib/api";
import { apiGetServer } from "@/lib/api-server";
import { isAdmin, isStaff, USER_COOKIE } from "@/lib/auth";
import { sortTeamsForDisplay } from "@/lib/team-categories";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Team } from "@/types/team";
import type { User } from "@/types/user";

export default async function GroupsPage() {
  const userCookie = (await cookies()).get(USER_COOKIE)?.value;
  let currentUser: User | null = null;
  if (userCookie) {
    try {
      currentUser = JSON.parse(decodeURIComponent(userCookie)) as User;
    } catch {
      currentUser = null;
    }
  }

  if (!isStaff(currentUser)) {
    redirect("/");
  }

  let teams: Team[] = [];
  let error: string | null = null;
  try {
    teams = await apiGetServer<Team[]>("/api/v1/teams", { revalidate: 120 });
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
    <main className="star-page">
      <PageHero
        title="Grupper"
        lead={
          adminView
            ? "SF er hovedgruppe for alle agenter. Undergrupper (Virksomhed, North Star m.fl.) modtager sager for deres organisation. Administratorer kan redigere medlemmer."
            : "SF er hovedgruppe for alle agenter. Undergrupper modtager sager for deres organisation."
        }
      />

      {adminView ? (
        <AdminGroupsPanel initialTeams={sortedTeams} initialError={error} />
      ) : error ? (
        <p className="text-destructive mt-6 text-sm">{error}</p>
      ) : sortedTeams.length === 0 ? (
        <p className="text-muted-foreground mt-6 text-sm">Ingen grupper fundet.</p>
      ) : (
        <GroupsTeamSections teams={sortedTeams} />
      )}
    </main>
  );
}
