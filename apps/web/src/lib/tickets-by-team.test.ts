import { describe, expect, it } from "vitest";

import {
  buildTicketsByTeamMap,
  getTicketsForTeam,
  teamIdMapKey,
} from "./tickets-by-team";
import type { Ticket } from "@/types/ticket";

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "t1",
    ticket_number: "INC-1",
    title: "Team ticket",
    status: "new",
    priority: "medium",
    ticket_type: "incident",
    is_major: false,
    sub_causes: [],
    created_at: "2026-06-10T10:00:00.000Z",
    ...overrides,
  };
}

describe("teamIdMapKey", () => {
  it("normalises team ids to lowercase", () => {
    expect(teamIdMapKey("TEAM-ABC")).toBe("team-abc");
  });
});

describe("buildTicketsByTeamMap", () => {
  it("groups tickets by assigned team and sorts newest first", () => {
    const map = buildTicketsByTeamMap([
      makeTicket({
        id: "old",
        assigned_team_id: "Team-1",
        created_at: "2026-06-01T10:00:00.000Z",
      }),
      makeTicket({
        id: "new",
        assigned_team_id: "team-1",
        created_at: "2026-06-10T10:00:00.000Z",
      }),
      makeTicket({ id: "unassigned", assigned_team_id: undefined }),
    ]);

    expect(map.get("team-1")?.map((t) => t.id)).toEqual(["new", "old"]);
    expect(map.has("unassigned")).toBe(false);
  });
});

describe("getTicketsForTeam", () => {
  it("returns tickets for normalised team id", () => {
    const map = buildTicketsByTeamMap([
      makeTicket({ id: "a", assigned_team_id: "team-2" }),
    ]);
    expect(getTicketsForTeam(map, "TEAM-2").map((t) => t.id)).toEqual(["a"]);
    expect(getTicketsForTeam(map, "missing")).toEqual([]);
  });
});
