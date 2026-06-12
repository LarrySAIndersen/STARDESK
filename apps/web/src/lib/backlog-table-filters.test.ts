import { describe, expect, it } from "vitest";

import {
  DEFAULT_BACKLOG_TABLE_FILTERS,
  applyBacklogTableFilters,
  hasActiveBacklogTableFilters,
} from "./backlog-table-filters";
import type { Ticket } from "@/types/ticket";

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "t1",
    ticket_number: "INC-1",
    title: "Backlog",
    status: "new",
    priority: "medium",
    ticket_type: "incident",
    is_major: false,
    sub_causes: [],
    created_at: "2026-06-10T10:00:00.000Z",
    ...overrides,
  };
}

describe("applyBacklogTableFilters", () => {
  const tickets = [
    makeTicket({
      id: "mine",
      assigned_user_id: "user-1",
      ticket_type: "incident",
    }),
    makeTicket({ id: "open", assigned_user_id: undefined, ticket_type: "problem" }),
  ];

  it("filters assignment mine and unassigned", () => {
    expect(
      applyBacklogTableFilters(tickets, { ...DEFAULT_BACKLOG_TABLE_FILTERS, assignment: "mine" }, "user-1").map(
        (t) => t.id,
      ),
    ).toEqual(["mine"]);

    expect(
      applyBacklogTableFilters(
        tickets,
        { ...DEFAULT_BACKLOG_TABLE_FILTERS, assignment: "unassigned" },
        "user-1",
      ).map((t) => t.id),
    ).toEqual(["open"]);

    expect(
      applyBacklogTableFilters(
        tickets,
        { ...DEFAULT_BACKLOG_TABLE_FILTERS, assignment: "mine" },
        undefined,
      ),
    ).toEqual([]);
  });

  it("filters ticket type", () => {
    expect(
      applyBacklogTableFilters(
        tickets,
        {
          ...DEFAULT_BACKLOG_TABLE_FILTERS,
          ticket_type: "problem",
        },
        undefined,
      ).map((t) => t.id),
    ).toEqual(["open"]);
  });
});

describe("hasActiveBacklogTableFilters", () => {
  it("detects backlog-specific filters", () => {
    expect(hasActiveBacklogTableFilters(DEFAULT_BACKLOG_TABLE_FILTERS)).toBe(true);
    expect(
      hasActiveBacklogTableFilters({
        ...DEFAULT_BACKLOG_TABLE_FILTERS,
        sort: "queue",
      }),
    ).toBe(true);
    expect(
      hasActiveBacklogTableFilters({
        ...DEFAULT_BACKLOG_TABLE_FILTERS,
        assignment: "mine",
      }),
    ).toBe(true);
    expect(
      hasActiveBacklogTableFilters({
        ...DEFAULT_BACKLOG_TABLE_FILTERS,
        sort: "sla_asc",
      }),
    ).toBe(true);
  });
});
