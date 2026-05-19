import { StarSectionCard } from "@/components/star/section-card";
import { StarLinkArrow } from "@/components/star/link-arrow";
import { apiGetServer } from "@/lib/api-server";
import type { Team } from "@/types/team";

function sortTeams(teams: Team[]): Team[] {
  return [...teams].sort((a, b) => {
    if (a.name === "SF") {
      return -1;
    }
    if (b.name === "SF") {
      return 1;
    }
    return a.name.localeCompare(b.name, "da");
  });
}

export async function AgentGroupsPanel() {
  let teams: Team[] = [];
  let error: string | null = null;
  try {
    teams = sortTeams(await apiGetServer<Team[]>("/api/v1/teams"));
  } catch {
    error = "Kunne ikke hente grupper";
  }

  return (
    <StarSectionCard
      variant="default"
      title="Grupper"
      description="SF-hovedgruppe og organisationsgrupper med tilknyttede sagsbehandlere."
    >
      <p className="mb-4">
        <StarLinkArrow href="/groups">Se alle grupper</StarLinkArrow>
      </p>
      {error ? (
        <p className="text-star-red text-sm">{error}</p>
      ) : teams.length === 0 ? (
        <p className="text-muted-foreground text-sm">Ingen grupper fundet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.slice(0, 6).map((team) => (
            <li
              key={team.id}
              className="border-input rounded-md border bg-white p-3 text-sm shadow-xs"
            >
              <p className="text-star-navy font-semibold">{team.name}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {team.members.length} medlem{team.members.length === 1 ? "" : "mer"}
              </p>
            </li>
          ))}
        </ul>
      )}
      {teams.length > 6 ? (
        <p className="text-muted-foreground mt-3 text-xs">
          + {teams.length - 6} grupper mere på gruppesiden
        </p>
      ) : null}
    </StarSectionCard>
  );
}
