import { describe, expect, it } from "vitest";

import {
  firstUnassignedWithRouting,
  routingConfidenceForTeamAssign,
  routingReadinessMessage,
} from "./ticket-routing";
import type { Ticket, TicketRouting } from "@/types/ticket";

function makeRouting(overrides: Partial<TicketRouting> = {}): TicketRouting {
  return {
    completeness_score: 80,
    routing_ready: true,
    missing_fields_da: [],
    intake: { answers: {} },
    computed_priority: "medium",
    computed_priority_label_da: "Medium",
    computed_priority_reasons_da: [],
    ...overrides,
  };
}

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "ticket-abc",
    ticket_number: "INC-1",
    title: "Routing test",
    status: "new",
    priority: "medium",
    ticket_type: "incident",
    is_major: false,
    sub_causes: [],
    created_at: "2026-06-10T10:00:00.000Z",
    ...overrides,
  };
}

describe("routingConfidenceForTeamAssign", () => {
  it("returns API confidence when suggested team matches", () => {
    const ticket = makeTicket({
      routing: makeRouting({
        suggested_team_id: "team-a",
        suggested_team_name: "Team A",
        routing_confidence: 88,
      }),
    });
    expect(routingConfidenceForTeamAssign(ticket, "team-a", [])).toBe(88);
  });

  it("reduces confidence for non-suggested teams", () => {
    const ticket = makeTicket({
      routing: makeRouting({
        suggested_team_id: "team-a",
        suggested_team_name: "Team A",
        routing_confidence: 88,
      }),
    });
    expect(routingConfidenceForTeamAssign(ticket, "team-b", [])).toBe(53);
  });

  it("returns deterministic hash-based score without routing data", () => {
    const ticket = makeTicket({ routing: undefined });
    const score = routingConfidenceForTeamAssign(ticket, "team-x", []);
    expect(score).toBeGreaterThanOrEqual(25);
    expect(score).toBeLessThanOrEqual(95);
    expect(routingConfidenceForTeamAssign(ticket, "team-x", [])).toBe(score);
  });
});

describe("routingReadinessMessage", () => {
  it("lists missing Danish fields", () => {
    const routing = makeRouting({
      suggested_team_id: null,
      suggested_team_name: null,
      routing_confidence: null,
      missing_fields_da: ["Kategori", "Underkategori"],
    });
    expect(routingReadinessMessage(routing)).toBe(
      "Auto-tildeling afventer: mangler Kategori, Underkategori",
    );
  });
});

describe("firstUnassignedWithRouting", () => {
  it("returns first open unassigned ticket with routing suggestion", () => {
    const match = makeTicket({
      id: "t1",
      assigned_team_id: null,
      status: "new",
      routing: makeRouting({
        suggested_team_id: "team-1",
        suggested_team_name: "Helpdesk",
        routing_confidence: 70,
      }),
    });
    const closed = makeTicket({
      id: "t2",
      status: "closed",
      routing: makeRouting({
        suggested_team_id: "team-1",
        suggested_team_name: "Helpdesk",
        routing_confidence: 70,
      }),
    });

    expect(firstUnassignedWithRouting([closed, match])).toEqual(match);
  });

  it("returns null when no candidate exists", () => {
    expect(
      firstUnassignedWithRouting([
        makeTicket({ assigned_team_id: "team-1", status: "new" }),
        makeTicket({ status: "resolved" }),
      ]),
    ).toBeNull();
  });

  it("ignores tickets without suggested team name", () => {
    expect(
      firstUnassignedWithRouting([
        makeTicket({
          routing: makeRouting({
            suggested_team_id: "team-1",
            suggested_team_name: null,
            routing_confidence: 50,
          }),
        }),
      ]),
    ).toBeNull();
  });
});
