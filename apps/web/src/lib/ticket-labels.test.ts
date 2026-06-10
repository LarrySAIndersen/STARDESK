import { describe, expect, it } from "vitest";

import { priorityLabel, statusLabel, ticketTypeLabel } from "./ticket-labels";

describe("statusLabel", () => {
  it("maps known statuses to Danish labels", () => {
    expect(statusLabel("new")).toBe("Ny");
    expect(statusLabel("in_progress")).toBe("I gang");
    expect(statusLabel("resolved")).toBe("Løst");
  });

  it("returns raw status for unknown values", () => {
    expect(statusLabel("custom_status")).toBe("custom_status");
  });
});

describe("priorityLabel", () => {
  it("maps known priorities to Danish labels", () => {
    expect(priorityLabel("critical")).toBe("Kritisk");
    expect(priorityLabel("low")).toBe("Lav");
  });

  it("returns raw priority for unknown values", () => {
    expect(priorityLabel("urgent")).toBe("urgent");
  });
});

describe("ticketTypeLabel", () => {
  it("maps known ticket types to Danish labels", () => {
    expect(ticketTypeLabel("incident")).toBe("Hændelse");
    expect(ticketTypeLabel("service_request")).toBe("Serviceanmodning");
  });

  it("returns raw type for unknown values", () => {
    expect(ticketTypeLabel("task")).toBe("task");
  });
});
