import { describe, expect, it } from "vitest";

import { DEFAULT_TICKET_SORT, TICKET_SORT_OPTIONS, parseTicketSort } from "./ticket-sort";

describe("parseTicketSort", () => {
  it("returns default for invalid values", () => {
    expect(parseTicketSort(undefined)).toBe(DEFAULT_TICKET_SORT);
    expect(parseTicketSort("not-a-sort")).toBe(DEFAULT_TICKET_SORT);
  });

  it("accepts valid sort options", () => {
    for (const option of TICKET_SORT_OPTIONS) {
      expect(parseTicketSort(option.value)).toBe(option.value);
    }
  });
});
