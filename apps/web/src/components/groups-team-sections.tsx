import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { partitionTeamsByCategory } from "@/lib/team-categories";
import type { Team } from "@/types/team";

function TeamCard({
  team,
  onEditMembers,
}: {
  team: Team;
  onEditMembers?: (team: Team) => void;
}) {
  return (
    <Card className="star-section-card overflow-hidden">
      <CardHeader className="bg-star-blue-light border-b">
        <CardTitle className="text-star-navy flex items-center gap-2">
          {team.name}
          {team.name === "SF" ? (
            <span className="bg-star-blue rounded px-1.5 py-0.5 text-[10px] font-semibold text-white uppercase">
              Hovedgruppe
            </span>
          ) : null}
        </CardTitle>
        {team.description ? <CardDescription>{team.description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">
          Medlemmer ({team.members.length})
        </p>
        {team.members.length === 0 ? (
          <p className="text-muted-foreground text-sm">Ingen medlemmer</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {team.members.map((member) => (
              <li key={member.user_id} className="flex justify-between gap-2">
                <span>{member.display_name}</span>
                <span className="text-muted-foreground text-xs">{member.role_label}</span>
              </li>
            ))}
          </ul>
        )}
        {onEditMembers ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => onEditMembers(team)}
          >
            Rediger medlemmer
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TeamGrid({
  teams,
  onEditMembers,
}: {
  teams: Team[];
  onEditMembers?: (team: Team) => void;
}) {
  if (teams.length === 0) {
    return <p className="text-muted-foreground text-sm">Ingen grupper i denne kategori.</p>;
  }

  return (
    <ul className="grid gap-6">
      {teams.map((team) => (
        <li key={team.id}>
          <TeamCard team={team} onEditMembers={onEditMembers} />
        </li>
      ))}
    </ul>
  );
}

export function GroupsTeamSections({
  teams,
  onEditMembers,
}: {
  teams: Team[];
  onEditMembers?: (team: Team) => void;
}) {
  const { internal, external } = partitionTeamsByCategory(teams);

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-8">
      <section aria-labelledby="internal-groups-heading">
        <h2
          id="internal-groups-heading"
          className="text-star-navy text-lg font-semibold tracking-tight"
        >
          Interne grupper
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          SF-hovedgruppe, SF-drift og tilknyttede virksomhedsgrupper.
        </p>
        <div className="mt-4">
          <TeamGrid teams={internal} onEditMembers={onEditMembers} />
        </div>
      </section>

      <section aria-labelledby="external-groups-heading">
        <h2
          id="external-groups-heading"
          className="text-star-navy text-lg font-semibold tracking-tight"
        >
          Eksterne grupper
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">Øvrige support- og driftsgrupper.</p>
        <div className="mt-4">
          <TeamGrid teams={external} onEditMembers={onEditMembers} />
        </div>
      </section>
    </div>
  );
}
