import { describe, expect, it } from "vitest";

import { formatTagsForInput, parseTagsInput, ticketMatchesSearch } from "./ticket-tags";

describe("parseTagsInput", () => {
  it("parses comma and semicolon separated tags", () => {
    expect(parseTagsInput(" VIP, kontor;vip ")).toEqual(["vip", "kontor"]);
  });

  it("returns empty for blank input", () => {
    expect(parseTagsInput("   ")).toEqual([]);
  });

  it("caps at ten unique tags", () => {
    const tags = parseTagsInput(
      "a,b,c,d,e,f,g,h,i,j,k",
    );
    expect(tags).toHaveLength(10);
  });
});

describe("formatTagsForInput", () => {
  it("joins tags with comma", () => {
    expect(formatTagsForInput(["vip", "kontor"])).toBe("vip, kontor");
    expect(formatTagsForInput(undefined)).toBe("");
  });
});

describe("ticketMatchesSearch", () => {
  const ticket = {
    title: "Printer fejl",
    ticket_number: "INC-42",
    tags: ["kontor"],
  };

  it("matches empty query", () => {
    expect(ticketMatchesSearch(ticket, "")).toBe(true);
  });

  it("matches title, number and tags", () => {
    expect(ticketMatchesSearch(ticket, "printer")).toBe(true);
    expect(ticketMatchesSearch(ticket, "inc-42")).toBe(true);
    expect(ticketMatchesSearch(ticket, "kontor")).toBe(true);
    expect(ticketMatchesSearch(ticket, "fax")).toBe(false);
  });
});
