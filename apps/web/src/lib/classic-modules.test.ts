import { describe, expect, it } from "vitest";

import { CLASSIC_MODULES, classicModuleBySegment } from "./classic-modules";
import type { Ticket } from "@/types/ticket";

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "t1",
    ticket_number: "INC-1",
    title: "Classic module",
    status: "new",
    priority: "medium",
    ticket_type: "incident",
    is_major: false,
    sub_causes: [],
    created_at: "2026-06-10T10:00:00.000Z",
    ...overrides,
  };
}

describe("CLASSIC_MODULES", () => {
  it("defines incident, change, problem and service request matchers", () => {
    const incident = CLASSIC_MODULES.find((m) => m.id === "incidents")!;
    const problem = CLASSIC_MODULES.find((m) => m.id === "problems")!;
    expect(incident.match(makeTicket({ ticket_type: "incident" }))).toBe(true);
    expect(incident.match(makeTicket({ ticket_type: "problem" }))).toBe(false);
    expect(problem.match(makeTicket({ ticket_type: "problem" }))).toBe(true);
  });
});

describe("classicModuleBySegment", () => {
  it("finds module by URL segment", () => {
    expect(classicModuleBySegment("incidents")?.label).toBe("Incidents");
    expect(classicModuleBySegment("unknown")).toBeUndefined();
  });
});
