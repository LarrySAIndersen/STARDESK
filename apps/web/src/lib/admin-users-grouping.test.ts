import { describe, expect, it } from "vitest";

import {
  ADMIN_USERS_NO_TEAM_FILTER,
  DEFAULT_ADMIN_USERS_FILTERS,
  applyAdminUsersListFilters,
  countUsersByTab,
  filterAdminUsers,
  userMatchesUsersTab,
} from "./admin-users-grouping";
import type { UserAdminListItem } from "@/types/admin-user";
import type { Team } from "@/types/team";

function makeUser(overrides: Partial<UserAdminListItem> = {}): UserAdminListItem {
  return {
    id: "u1",
    email: "a@example.dk",
    display_name: "Anna Agent",
    role: "agent",
    role_label: "Agent",
    roles: ["agent"],
    role_labels: ["Agent"],
    is_active: true,
    organization_name: "STAR",
    team_ids: ["team-int"],
    team_names: ["SF"],
    ...overrides,
  };
}

const teams: Team[] = [
  { id: "team-int", name: "SF", description: "", is_active: true, members: [] },
  { id: "team-ext", name: "External Partner", description: "", is_active: true, members: [] },
];

describe("filterAdminUsers", () => {
  const users = [
    makeUser(),
    makeUser({
      id: "u2",
      email: "b@example.dk",
      display_name: "Børge Borger",
      role_label: "Kunde",
      team_names: ["Partner"],
    }),
  ];

  it("returns all when query empty", () => {
    expect(filterAdminUsers(users, "")).toHaveLength(2);
  });

  it("matches email, role and team name", () => {
    expect(filterAdminUsers(users, "anna")).toHaveLength(1);
    expect(filterAdminUsers(users, "kunde")).toHaveLength(1);
    expect(filterAdminUsers(users, "partner")).toHaveLength(1);
  });
});

describe("userMatchesUsersTab", () => {
  const internalIds = new Set(["team-int"]);
  const externalIds = new Set(["team-ext"]);

  it("classifies internal, external and all tabs", () => {
    const internalUser = makeUser({ team_ids: ["team-int"] });
    const externalUser = makeUser({ team_ids: ["team-ext"], team_names: ["Partner"] });
    expect(userMatchesUsersTab(internalUser, "all", internalIds, externalIds)).toBe(true);
    expect(userMatchesUsersTab(internalUser, "internal", internalIds, externalIds)).toBe(true);
    expect(userMatchesUsersTab(externalUser, "external", internalIds, externalIds)).toBe(true);
    expect(userMatchesUsersTab(makeUser({ team_ids: [] }), "internal", internalIds, externalIds)).toBe(
      false,
    );
  });
});

describe("countUsersByTab", () => {
  it("counts users per tab", () => {
    const users = [
      makeUser({ team_ids: ["team-int"] }),
      makeUser({ id: "u2", team_ids: ["team-ext"], team_names: ["Partner"] }),
    ];
    expect(countUsersByTab(users, teams)).toEqual({ internal: 1, external: 1, all: 2 });
  });
});

describe("applyAdminUsersListFilters", () => {
  const users = [
    makeUser({ id: "active", is_active: true, roles: ["agent"] }),
    makeUser({
      id: "inactive",
      display_name: "Zeta",
      is_active: false,
      roles: ["end_user"],
      team_ids: [],
      team_names: [],
    }),
  ];

  it("filters by tab, role, status and team", () => {
    const filtered = applyAdminUsersListFilters(
      users,
      teams,
      "all",
      { ...DEFAULT_ADMIN_USERS_FILTERS, role: "agent", status: "active" },
    );
    expect(filtered.map((u) => u.id)).toEqual(["active"]);
  });

  it("filters users with no team", () => {
    const filtered = applyAdminUsersListFilters(users, teams, "all", {
      ...DEFAULT_ADMIN_USERS_FILTERS,
      teamId: ADMIN_USERS_NO_TEAM_FILTER,
    });
    expect(filtered.map((u) => u.id)).toEqual(["inactive"]);
  });

  it("sorts by name descending", () => {
    const sorted = applyAdminUsersListFilters(users, teams, "all", {
      ...DEFAULT_ADMIN_USERS_FILTERS,
      sort: "name_desc",
    });
    expect(sorted[0]?.display_name).toBe("Zeta");
  });
});
