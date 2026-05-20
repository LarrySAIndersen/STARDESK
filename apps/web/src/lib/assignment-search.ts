import type { Team } from "@/types/team";

export type AssignablePerson = {
  userId: string;
  displayName: string;
  email: string;
  teamId: string;
  teamName: string;
};

export type SearchableOption = {
  id: string;
  label: string;
  sublabel?: string;
};

const UNASSIGNED_ID = "";

export function unassignedOption(label: string): SearchableOption {
  return { id: UNASSIGNED_ID, label };
}

export function isUnassignedOption(id: string): boolean {
  return id === UNASSIGNED_ID;
}

function normalizeQuery(query: string): string {
  return query.trim().toLocaleLowerCase("da");
}

function matchesQuery(text: string, query: string): boolean {
  if (!query) {
    return true;
  }
  return text.toLocaleLowerCase("da").includes(query);
}

export function filterTeamsForSearch(teams: Team[], query: string): SearchableOption[] {
  const q = normalizeQuery(query);
  return teams
    .filter((team) => team.is_active && matchesQuery(team.name, q))
    .map((team) => ({ id: team.id, label: team.name }));
}

export function buildAssignablePeople(teams: Team[]): AssignablePerson[] {
  const seen = new Set<string>();
  const people: AssignablePerson[] = [];
  for (const team of teams) {
    if (!team.is_active) {
      continue;
    }
    for (const member of team.members) {
      if (seen.has(member.user_id)) {
        continue;
      }
      seen.add(member.user_id);
      people.push({
        userId: member.user_id,
        displayName: member.display_name,
        email: member.email,
        teamId: team.id,
        teamName: team.name,
      });
    }
  }
  return people.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "da"),
  );
}

export function filterPeopleForSearch(
  people: AssignablePerson[],
  query: string,
  teamId?: string | null,
): SearchableOption[] {
  const q = normalizeQuery(query);
  return people
    .filter((person) => {
      if (teamId && person.teamId !== teamId) {
        return false;
      }
      const haystack = `${person.displayName} ${person.email} ${person.teamName}`;
      return matchesQuery(haystack, q);
    })
    .map((person) => ({
      id: person.userId,
      label: person.displayName,
      sublabel: teamId ? person.email : `${person.teamName} · ${person.email}`,
    }));
}

export function findPersonByUserId(
  people: AssignablePerson[],
  userId: string | null,
): AssignablePerson | undefined {
  if (!userId) {
    return undefined;
  }
  return people.find((person) => person.userId === userId);
}
