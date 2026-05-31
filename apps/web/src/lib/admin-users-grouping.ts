import { partitionTeamsByCategory } from "@/lib/team-categories";
import type { UserAdminListItem } from "@/types/admin-user";
import type { Team } from "@/types/team";

export type UsersTab = "internal" | "external" | "all";

export type AdminUsersListFilters = {
  role: string;
  teamId: string;
  status: string;
  sort: string;
};

export const DEFAULT_ADMIN_USERS_FILTERS: AdminUsersListFilters = {
  role: "",
  teamId: "",
  status: "",
  sort: "name_asc",
};

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
    if (user.role_labels?.some((label) => label.toLowerCase().includes(q))) {
      return true;
    }
    if (user.roles?.some((role) => role.toLowerCase().includes(q))) {
      return true;
    }
    if (user.organization_name?.toLowerCase().includes(q)) {
      return true;
    }
    return user.team_names.some((name) => name.toLowerCase().includes(q));
  });
}

function teamIdSets(teams: Team[]) {
  const { internal, external } = partitionTeamsByCategory(teams);
  return {
    internalIds: new Set(internal.map((t) => t.id)),
    externalIds: new Set(external.map((t) => t.id)),
  };
}

export function userMatchesUsersTab(
  user: UserAdminListItem,
  tab: UsersTab,
  internalIds: Set<string>,
  externalIds: Set<string>,
): boolean {
  if (tab === "all") {
    return true;
  }
  if (user.team_ids.length === 0) {
    return false;
  }
  if (tab === "internal") {
    return user.team_ids.some((id) => internalIds.has(id));
  }
  return user.team_ids.some((id) => externalIds.has(id));
}

export function countUsersByTab(
  users: UserAdminListItem[],
  teams: Team[],
): Record<UsersTab, number> {
  const { internalIds, externalIds } = teamIdSets(teams);
  let internal = 0;
  let external = 0;
  for (const user of users) {
    if (userMatchesUsersTab(user, "internal", internalIds, externalIds)) {
      internal += 1;
    }
    if (userMatchesUsersTab(user, "external", internalIds, externalIds)) {
      external += 1;
    }
  }
  return { internal, external, all: users.length };
}

function compareAdminUsers(
  a: UserAdminListItem,
  b: UserAdminListItem,
  sort: string,
): number {
  switch (sort) {
    case "name_desc":
      return b.display_name.localeCompare(a.display_name, "da");
    case "email":
      return a.email.localeCompare(b.email, "da");
    case "role": {
      const aLabel = a.role_labels?.join(", ") ?? a.role_label;
      const bLabel = b.role_labels?.join(", ") ?? b.role_label;
      return aLabel.localeCompare(bLabel, "da");
    }
    case "status":
      return Number(b.is_active) - Number(a.is_active);
    case "name_asc":
    default:
      return a.display_name.localeCompare(b.display_name, "da");
  }
}

export function applyAdminUsersListFilters(
  users: UserAdminListItem[],
  teams: Team[],
  tab: UsersTab,
  filters: AdminUsersListFilters,
): UserAdminListItem[] {
  const { internalIds, externalIds } = teamIdSets(teams);
  const NO_TEAM = "__none__";

  const filtered = users.filter((user) => {
    if (!userMatchesUsersTab(user, tab, internalIds, externalIds)) {
      return false;
    }
    if (filters.role) {
      const userRoles = user.roles?.length ? user.roles : user.role ? [user.role] : [];
      if (!userRoles.includes(filters.role)) {
        return false;
      }
    }
    if (filters.status === "active" && !user.is_active) {
      return false;
    }
    if (filters.status === "inactive" && user.is_active) {
      return false;
    }
    if (filters.teamId === NO_TEAM && user.team_ids.length > 0) {
      return false;
    }
    if (
      filters.teamId &&
      filters.teamId !== NO_TEAM &&
      !user.team_ids.includes(filters.teamId)
    ) {
      return false;
    }
    return true;
  });

  return [...filtered].sort((a, b) => compareAdminUsers(a, b, filters.sort));
}

export const ADMIN_USERS_NO_TEAM_FILTER = "__none__";
