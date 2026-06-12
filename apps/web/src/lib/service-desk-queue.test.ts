import { describe, expect, it } from "vitest";

import {
  SERVICE_DESK_TEAM_NAME,
  filterByServiceDeskQueue,
  isAssignableFromServiceDeskQueue,
  isInServiceDeskQueue,
  isInTeamsQueue,
  isNewStatusTicket,
  isOpenTicket,
  paginateTickets,
  serviceDeskTeamIds,
  sortServiceDeskQueue,
  teamsForServiceDeskRail,
  ticketsForServiceDeskTable,
  ticketsForServiceDeskTeamRail,
} from "./service-desk-queue";
import type { Ticket } from "@/types/ticket";
import type { Team } from "@/types/team";

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "t1",
    ticket_number: "INC-1",
    title: "Queue test",
    status: "new",
    priority: "medium",
    ticket_type: "incident",
    is_major: false,
    sub_causes: [],
    created_at: "2026-06-10T10:00:00.000Z",
    ...overrides,
  };
}

const deskTeam: Team = {
  id: "desk-1",
  name: SERVICE_DESK_TEAM_NAME,
  description: null,
  is_active: true,
  members: [],
};

const opsTeam: Team = {
  id: "ops-1",
  name: "SF Operations",
  description: null,
  is_active: true,
  members: [],
};

describe("serviceDeskTeamIds", () => {
  it("collects desk team ids case-insensitively", () => {
    const ids = serviceDeskTeamIds([deskTeam, opsTeam]);
    expect(ids.has("desk-1")).toBe(true);
    expect(ids.has("ops-1")).toBe(false);
  });
});

describe("isInServiceDeskQueue", () => {
  const deskIds = new Set(["desk-1"]);

  it("includes new and unassigned tickets", () => {
    expect(isInServiceDeskQueue(makeTicket({ status: "new" }), deskIds)).toBe(true);
    expect(
      isInServiceDeskQueue(
        makeTicket({ status: "assigned", assigned_team_id: undefined }),
        deskIds,
      ),
    ).toBe(true);
  });

  it("includes tickets assigned to desk team", () => {
    expect(
      isInServiceDeskQueue(
        makeTicket({
          status: "assigned",
          assigned_team_id: "desk-1",
          assigned_team_name: SERVICE_DESK_TEAM_NAME,
        }),
        deskIds,
      ),
    ).toBe(true);
  });

  it("excludes tickets assigned to other teams", () => {
    expect(
      isInServiceDeskQueue(
        makeTicket({
          status: "assigned",
          assigned_team_id: "ops-1",
          assigned_team_name: "SF Operations",
        }),
        deskIds,
      ),
    ).toBe(false);
  });
});

describe("queue helpers", () => {
  const deskIds = new Set(["desk-1"]);
  const tickets = [
    makeTicket({ id: "new", status: "new" }),
    makeTicket({
      id: "ops",
      status: "assigned",
      assigned_team_id: "ops-1",
      assigned_team_name: "SF Operations",
    }),
  ];

  it("classifies open, assignable and team rail tickets", () => {
    expect(isOpenTicket(makeTicket({ status: "closed" }))).toBe(false);
    expect(isNewStatusTicket(tickets[0]!)).toBe(true);
    expect(isAssignableFromServiceDeskQueue(tickets[0]!, deskIds)).toBe(true);
    expect(isInTeamsQueue(tickets[1]!, deskIds)).toBe(true);
  });

  it("splits table vs team rail tickets", () => {
    expect(ticketsForServiceDeskTable(tickets, deskIds).map((t) => t.id)).toEqual(["new"]);
    expect(ticketsForServiceDeskTeamRail(tickets, deskIds).map((t) => t.id)).toEqual(["ops"]);
  });

  it("filters by queue mode", () => {
    const withClosed = [
      ...tickets,
      makeTicket({
        id: "closed",
        status: "closed",
        assigned_team_id: "ops-1",
        assigned_team_name: "SF Operations",
      }),
    ];
    expect(filterByServiceDeskQueue(withClosed, "desk", deskIds).map((t) => t.id)).toEqual(["new"]);
    expect(filterByServiceDeskQueue(withClosed, "teams", deskIds).map((t) => t.id)).toEqual(["ops"]);
    expect(filterByServiceDeskQueue(withClosed, "all", deskIds)).toHaveLength(2);
  });

  it("excludes desk team from rail team list", () => {
    expect(teamsForServiceDeskRail([deskTeam, opsTeam], deskIds).map((t) => t.id)).toEqual([
      "ops-1",
    ]);
  });
});

describe("sortServiceDeskQueue", () => {
  it("prioritises desk queue then critical priority", () => {
    const sorted = sortServiceDeskQueue(
      [
        makeTicket({
          id: "ops",
          status: "assigned",
          assigned_team_id: "ops-1",
          priority: "critical",
          created_at: "2026-06-09T10:00:00.000Z",
        }),
        makeTicket({
          id: "desk-low",
          status: "new",
          priority: "low",
          created_at: "2026-06-08T10:00:00.000Z",
        }),
        makeTicket({
          id: "desk-critical",
          status: "new",
          priority: "critical",
          created_at: "2026-06-10T10:00:00.000Z",
        }),
      ],
      new Set(["desk-1"]),
    );
    expect(sorted.map((t) => t.id)).toEqual(["desk-critical", "desk-low", "ops"]);
  });
});

describe("paginateTickets", () => {
  it("slices by offset and page size", () => {
    expect(paginateTickets([1, 2, 3, 4], 1, 2)).toEqual([2, 3]);
  });
});
