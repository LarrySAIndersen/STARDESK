import { describe, expect, it } from "vitest";

import {
  DASHBOARD_SCOPE_DESCRIPTIONS,
  DASHBOARD_SCOPE_LABELS,
  buildTicketsFilterHref,
} from "./dashboard-ticket-links";

describe("buildTicketsFilterHref", () => {
  it("returns bare /tickets when no filters", () => {
    expect(buildTicketsFilterHref({})).toBe("/tickets");
  });

  it("serialises scope and boolean filters", () => {
    const href = buildTicketsFilterHref({
      scope: "mine",
      openOnly: true,
      sla: "overdue",
      majorOpen: true,
      securityOnly: true,
    });
    expect(href).toBe(
      "/tickets?scope=mine&open_only=true&sla=overdue&major_open=true&security_only=true",
    );
  });

  it("includes numeric and id filters", () => {
    const href = buildTicketsFilterHref({
      openedSinceDays: 7,
      parentId: "parent-1",
      assignedTeamId: "team-1",
      createdOn: "2026-06-01",
    });
    expect(href).toContain("opened_since_days=7");
    expect(href).toContain("parent_id=parent-1");
    expect(href).toContain("assigned_team_id=team-1");
    expect(href).toContain("created_on=2026-06-01");
  });
});

describe("dashboard scope labels", () => {
  it("defines Danish labels for all scopes", () => {
    expect(DASHBOARD_SCOPE_LABELS.mine).toBe("Mine sager");
    expect(DASHBOARD_SCOPE_DESCRIPTIONS.all).toContain("administrator");
  });
});
