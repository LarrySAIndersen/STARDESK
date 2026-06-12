import { describe, expect, it } from "vitest";

import {
  bucketInProgressCount,
  confidenceColor,
  confidenceVerdict,
  confidenceVerdictClass,
  mockAssignmentConfidence,
  ticketDragPayload,
  wirePriorityBadgeClass,
  wireStatusBadgeClass,
} from "./wireframe-labels";
import type { Ticket } from "@/types/ticket";

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "t1",
    ticket_number: "INC-1",
    title: "Wireframe ticket",
    status: "new",
    priority: "medium",
    ticket_type: "incident",
    is_major: false,
    sub_causes: [],
    created_at: "2026-06-10T10:00:00.000Z",
    category_name_da: "Netværk",
    tags: ["vip"],
    description: "Beskrivelse",
    ...overrides,
  };
}

describe("wirePriorityBadgeClass", () => {
  it("maps priority to badge class", () => {
    expect(wirePriorityBadgeClass("critical")).toBe("critical");
    expect(wirePriorityBadgeClass("unknown")).toBe("medium");
  });
});

describe("wireStatusBadgeClass", () => {
  it("maps status to badge class", () => {
    expect(wireStatusBadgeClass("closed")).toBe("resolved");
    expect(wireStatusBadgeClass("in_progress")).toBe("progress");
    expect(wireStatusBadgeClass("new")).toBe("open");
  });
});

describe("mockAssignmentConfidence", () => {
  it("returns deterministic score between 25 and 95", () => {
    const score = mockAssignmentConfidence("ticket-1", "member-1");
    expect(score).toBeGreaterThanOrEqual(25);
    expect(score).toBeLessThanOrEqual(95);
    expect(mockAssignmentConfidence("ticket-1", "member-1")).toBe(score);
  });
});

describe("confidence helpers", () => {
  it("maps score to color, verdict and class", () => {
    expect(confidenceColor(80)).toBe("#1A7A44");
    expect(confidenceVerdict(80)).toBe("God match");
    expect(confidenceVerdictClass(80)).toBe("cv-good");
    expect(confidenceVerdictClass(40)).toBe("cv-bad");
  });
});

describe("bucketInProgressCount", () => {
  it("reads igangsat bucket count", () => {
    expect(bucketInProgressCount([{ key: "igangsat", count: 7 }])).toBe(7);
    expect(bucketInProgressCount(undefined)).toBe(0);
  });
});

describe("ticketDragPayload", () => {
  it("serialises ticket fields for drag overlay", () => {
    expect(ticketDragPayload(makeTicket())).toMatchObject({
      id: "t1",
      number: "INC-1",
      category: "Netværk",
      tags: "vip",
    });
  });
});
