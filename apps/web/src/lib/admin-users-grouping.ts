import { partitionTeamsByCategory } from "@/lib/team-categories";
import type { UserAdminListItem } from "@/types/admin-user";
import type { Team } from "@/types/team";

export function filterAdminUsers(
  users: UserAdminListItem[],
  query: string,
): UserAdminListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return users;
  }
  return users.filter((user) => {
    if (user.display_name.toLowerCase().includes(q)) {
      return true;
    }
    if (user.email.toLowerCase().includes(q)) {
      return true;
    }
    if (user.role_label.toLowerCase().includes(q)) {
      return true;
    }
    if (user.organization_name?.toLowerCase().includes(q)) {
      return true;
    }
    return user.team_names.some((name) => name.toLowerCase().includes(q));
  });
}

export type UsersByTeamSection = {
  team: Team;
  users: UserAdminListItem[];
};

export type GroupedAdminUsers = {
  internal: UsersByTeamSection[];
  external: UsersByTeamSection[];
  ungrouped: UserAdminListItem[];
};

export function groupAdminUsersByTeam(
  users: UserAdminListItem[],
  teams: Team[],
): GroupedAdminUsers {
  const { internal, external } = partitionTeamsByCategory(teams);

  const mapTeamSection = (team: Team): UsersByTeamSection => ({
    team,
    users: users
      .filter((user) => user.team_ids.includes(team.id))
      .sort((a, b) => a.display_name.localeCompare(b.display_name, "da")),
  });

  const ungrouped = users
    .filter((user) => user.team_ids.length === 0)
    .sort((a, b) => a.display_name.localeCompare(b.display_name, "da"));

  return {
    internal: internal.map(mapTeamSection),
    external: external.map(mapTeamSection),
    ungrouped,
  };
}
