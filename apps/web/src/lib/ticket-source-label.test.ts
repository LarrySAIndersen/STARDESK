import { describe, expect, it } from "vitest";

import { ticketSourceLabelDa } from "./ticket-source-label";

describe("ticketSourceLabelDa", () => {
  it("maps known sources to Danish labels", () => {
    expect(ticketSourceLabelDa("portal")).toBe("Selvbetjening");
    expect(ticketSourceLabelDa("email")).toBe("E-mail");
  });

  it("falls back to Andet", () => {
    expect(ticketSourceLabelDa(null)).toBe("Andet");
    expect(ticketSourceLabelDa("unknown")).toBe("Andet");
  });
});
