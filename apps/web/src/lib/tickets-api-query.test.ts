import { describe, expect, it } from "vitest";

import {
  CLEARED_TICKETS_PATH,
  buildTicketsApiQuery,
  dashboardFilterTitle,
  hasTicketsUrlFilters,
} from "./tickets-api-query";
import { DEFAULT_TICKET_SORT } from "./ticket-sort";

describe("buildTicketsApiQuery", () => {
  it("defaults to board view when no dashboard filters", () => {
    const qs = buildTicketsApiQuery({});
    expect(qs).toContain("limit=500");
    expect(qs).toContain("board=true");
    expect(qs).toContain("open_only=true");
    expect(qs).toContain(`sort=${DEFAULT_TICKET_SORT}`);
  });

  it("passes scope and boolean drill-down flags", () => {
    const qs = buildTicketsApiQuery({
      scope: "mine",
      open_only: "true",
      major_open: "true",
      security_only: "true",
      is_store: "true",
    });
    expect(qs).toContain("scope=mine");
    expect(qs).toContain("major_open=true");
    expect(qs).toContain("security_only=true");
    expect(qs).not.toContain("board=true");
  });

  it("serialises array search params by first value", () => {
    const qs = buildTicketsApiQuery({
      status: ["new", "closed"],
      assigned_team_id: "team-1",
    });
    expect(qs).toContain("status=new");
    expect(qs).toContain("assigned_team_id=team-1");
  });
});

describe("dashboardFilterTitle", () => {
  it("builds Danish title parts", () => {
    expect(dashboardFilterTitle({ scope: "mine", sla: "overdue" })).toBe(
      "mine sager · SLA overskredet",
    );
    expect(dashboardFilterTitle({ major_open: "true" })).toBe("store sager");
    expect(dashboardFilterTitle({})).toBeNull();
  });

  it("resolves asset label when known", () => {
    const title = dashboardFilterTitle({ asset_id: "sys-star-platform" });
    expect(title).toContain("aktiv:");
  });
});

describe("hasTicketsUrlFilters", () => {
  it("ignores default sort only", () => {
    expect(hasTicketsUrlFilters({ sort: DEFAULT_TICKET_SORT })).toBe(false);
    expect(hasTicketsUrlFilters({ scope: "all" })).toBe(true);
  });
});

describe("CLEARED_TICKETS_PATH", () => {
  it("points to bare tickets route", () => {
    expect(CLEARED_TICKETS_PATH).toBe("/tickets");
  });
});
