import { describe, expect, it } from "vitest";

import {
  DEFAULT_SERVICE_DESK_TABLE_FILTERS,
  applyServiceDeskTableFilters,
  hasActiveServiceDeskTableFilters,
  sortServiceDeskTable,
  ticketSourceFilterLabel,
  ticketSourceFilterValue,
} from "./service-desk-table-filters";
import type { Ticket } from "@/types/ticket";

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "t1",
    ticket_number: "INC-100",
    title: "Test sag",
    status: "new",
    priority: "medium",
    ticket_type: "incident",
    is_major: false,
    sub_causes: [],
    created_at: "2026-06-10T10:00:00.000Z",
    ...overrides,
  };
}

describe("ticketSourceFilterValue", () => {
  it("returns trimmed source or other", () => {
    expect(ticketSourceFilterValue(makeTicket({ source: " portal " }))).toBe("portal");
    expect(ticketSourceFilterValue(makeTicket({ source: undefined }))).toBe("other");
  });
});

describe("ticketSourceFilterLabel", () => {
  it("maps other to Andet", () => {
    expect(ticketSourceFilterLabel("other")).toBe("Andet");
  });
});

describe("applyServiceDeskTableFilters", () => {
  const tickets = [
    makeTicket({
      id: "a",
      tags: ["vip"],
      source: "email",
      category_name_da: "Netværk",
      status: "new",
      priority: "critical",
      sla_breached: true,
    }),
    makeTicket({
      id: "b",
      priority: "low",
      sla_remaining_seconds: 1800,
      status: "in_progress",
    }),
  ];

  it("filters by tag, source, category, status, priority", () => {
    const result = applyServiceDeskTableFilters(tickets, {
      ...DEFAULT_SERVICE_DESK_TABLE_FILTERS,
      tag: "vip",
      source: "email",
      category: "Netværk",
      status: "new",
      priority: "critical",
    });
    expect(result.map((t) => t.id)).toEqual(["a"]);
  });

  it("filters critical_high tier and sla states", () => {
    expect(
      applyServiceDeskTableFilters(tickets, {
        ...DEFAULT_SERVICE_DESK_TABLE_FILTERS,
        priorityTier: "critical_high",
      }).map((t) => t.id),
    ).toEqual(["a"]);

    expect(
      applyServiceDeskTableFilters(tickets, {
        ...DEFAULT_SERVICE_DESK_TABLE_FILTERS,
        sla: "breached",
      }).map((t) => t.id),
    ).toEqual(["a"]);

    expect(
      applyServiceDeskTableFilters(tickets, {
        ...DEFAULT_SERVICE_DESK_TABLE_FILTERS,
        sla: "due_soon",
      }).map((t) => t.id),
    ).toEqual(["b"]);

    expect(
      applyServiceDeskTableFilters(tickets, {
        ...DEFAULT_SERVICE_DESK_TABLE_FILTERS,
        sla: "ok",
      }).map((t) => t.id),
    ).toEqual(["b"]);
  });
});

describe("sortServiceDeskTable", () => {
  const tickets = [
    makeTicket({ id: "1", ticket_number: "INC-2", title: "Beta", priority: "low" }),
    makeTicket({ id: "2", ticket_number: "INC-10", title: "Alpha", priority: "critical" }),
  ];

  it("sorts by ticket number and title", () => {
    expect(
      sortServiceDeskTable(tickets, "ticket_number_asc").map((t) => t.ticket_number),
    ).toEqual(["INC-2", "INC-10"]);
    expect(sortServiceDeskTable(tickets, "title_asc")[0]?.title).toBe("Alpha");
    expect(sortServiceDeskTable(tickets, "priority_asc")[0]?.priority).toBe("critical");
  });
});

describe("hasActiveServiceDeskTableFilters", () => {
  it("detects non-default filters", () => {
    expect(hasActiveServiceDeskTableFilters(DEFAULT_SERVICE_DESK_TABLE_FILTERS)).toBe(false);
    expect(
      hasActiveServiceDeskTableFilters({
        ...DEFAULT_SERVICE_DESK_TABLE_FILTERS,
        tag: "vip",
      }),
    ).toBe(true);
  });
});
