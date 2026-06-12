import { describe, expect, it } from "vitest";

import {
  TEAM_GROUP_PREVIEW_LIMIT,
  buildOpenAssignedTicketsByTeamMap,
  isTeamSelected,
  resolveTeamTicketDisplay,
  ticketDetailHref,
  toggleSelectedTeamId,
} from "./team-group-view";
import type { Ticket } from "@/types/ticket";

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "t1",
    ticket_number: "INC-1",
    title: "Group view",
    status: "assigned",
    priority: "medium",
    ticket_type: "incident",
    is_major: false,
    sub_causes: [],
    created_at: "2026-06-10T10:00:00.000Z",
    assigned_team_id: "team-1",
    ...overrides,
  };
}

describe("ticketDetailHref", () => {
  it("builds staff ticket detail path", () => {
    expect(ticketDetailHref("abc-123")).toBe("/tickets/abc-123");
  });
});

describe("buildOpenAssignedTicketsByTeamMap", () => {
  it("includes only open tickets with assigned team", () => {
    const map = buildOpenAssignedTicketsByTeamMap([
      makeTicket({ id: "open", assigned_team_id: "team-1" }),
      makeTicket({ id: "closed", status: "closed", assigned_team_id: "team-1" }),
      makeTicket({ id: "unassigned", assigned_team_id: undefined }),
    ]);
    expect(map.get("team-1")?.map((t) => t.id)).toEqual(["open"]);
  });
});

describe("team selection", () => {
  it("compares team ids case-insensitively", () => {
    expect(isTeamSelected("TEAM-1", "team-1")).toBe(true);
    expect(toggleSelectedTeamId("team-1", "team-1")).toBeNull();
    expect(toggleSelectedTeamId(null, "team-1")).toBe("team-1");
  });
});

describe("resolveTeamTicketDisplay", () => {
  it("limits preview until team is selected", () => {
    const tickets = Array.from({ length: TEAM_GROUP_PREVIEW_LIMIT + 2 }, (_, i) =>
      makeTicket({
        id: `t${i}`,
        assigned_team_id: "team-1",
        created_at: `2026-06-${String(i + 1).padStart(2, "0")}T10:00:00.000Z`,
      }),
    );
    const map = buildOpenAssignedTicketsByTeamMap(tickets);

    const preview = resolveTeamTicketDisplay(map, "team-1", null);
    expect(preview.visible).toHaveLength(TEAM_GROUP_PREVIEW_LIMIT);
    expect(preview.total).toBe(TEAM_GROUP_PREVIEW_LIMIT + 2);
    expect(preview.isSelected).toBe(false);

    const selected = resolveTeamTicketDisplay(map, "team-1", "team-1");
    expect(selected.visible).toHaveLength(TEAM_GROUP_PREVIEW_LIMIT + 2);
    expect(selected.showingAll).toBe(true);
  });
});
