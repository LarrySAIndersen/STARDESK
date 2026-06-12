import { describe, expect, it } from "vitest";

import { OPEN_TICKET_STATUSES, isOpenTicketStatus } from "./ticket-open-status";

describe("isOpenTicketStatus", () => {
  it("matches open statuses from API contract", () => {
    for (const status of OPEN_TICKET_STATUSES) {
      expect(isOpenTicketStatus(status)).toBe(true);
    }
    expect(isOpenTicketStatus("resolved")).toBe(false);
    expect(isOpenTicketStatus("closed")).toBe(false);
  });
});
