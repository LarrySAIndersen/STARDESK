import { describe, expect, it } from "vitest";

import {
  buildAssignablePeople,
  filterPeopleForSearch,
  filterTeamsForSearch,
  findPersonByUserId,
  isUnassignedOption,
  unassignedOption,
} from "./assignment-search";
import type { Team } from "@/types/team";

const teams: Team[] = [
  {
    id: "team-1",
    name: "SF Service Desk",
    description: null,
    is_active: true,
    members: [
      {
        user_id: "u1",
        display_name: "Anna Agent",
        email: "anna@example.dk",
        role: "agent",
        role_label: "Agent",
        joined_at: "2026-01-01T00:00:00.000Z",
      },
    ],
  },
  {
    id: "team-2",
    name: "SF Operations",
    description: null,
    is_active: true,
    members: [
      {
        user_id: "u2",
        display_name: "Bo Ops",
        email: "bo@example.dk",
        role: "agent",
        role_label: "Agent",
        joined_at: "2026-01-01T00:00:00.000Z",
      },
    ],
  },
  {
    id: "team-inactive",
    name: "Old Team",
    description: null,
    is_active: false,
    members: [],
  },
];

describe("unassignedOption", () => {
  it("uses empty id sentinel", () => {
    const option = unassignedOption("Ingen");
    expect(option.id).toBe("");
    expect(isUnassignedOption(option.id)).toBe(true);
  });
});

describe("filterTeamsForSearch", () => {
  it("filters active teams by Danish name", () => {
    const options = filterTeamsForSearch(teams, "service");
    expect(options).toEqual([{ id: "team-1", label: "SF Service Desk" }]);
  });
});

describe("buildAssignablePeople", () => {
  it("deduplicates members and sorts by display name", () => {
    const people = buildAssignablePeople(teams);
    expect(people.map((p) => p.userId)).toEqual(["u1", "u2"]);
    expect(people[0]?.displayName).toBe("Anna Agent");
  });
});

describe("filterPeopleForSearch", () => {
  const people = buildAssignablePeople(teams);

  it("filters by query and optional team", () => {
    expect(filterPeopleForSearch(people, "bo").map((p) => p.id)).toEqual(["u2"]);
    expect(filterPeopleForSearch(people, "", "team-1").map((p) => p.id)).toEqual(["u1"]);
    expect(filterPeopleForSearch(people, "bo", "team-1")).toEqual([]);
  });

  it("finds person by user id", () => {
    expect(findPersonByUserId(people, "u1")?.email).toBe("anna@example.dk");
    expect(findPersonByUserId(people, null)).toBeUndefined();
  });
});
