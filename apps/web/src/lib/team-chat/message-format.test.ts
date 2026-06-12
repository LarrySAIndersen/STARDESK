import { describe, expect, it } from "vitest";

import {
  dateKey,
  formatDateSeparator,
  formatMessageTime,
  senderInitials,
} from "@/lib/team-chat/message-format";

describe("senderInitials", () => {
  it("returns two letters for full name", () => {
    expect(senderInitials("Claus Møller")).toBe("CM");
  });

  it("returns first two chars for single name", () => {
    expect(senderInitials("Claus")).toBe("CL");
  });
});

describe("formatMessageTime", () => {
  it("formats as HH:mm", () => {
    expect(formatMessageTime("2026-06-12T09:05:00.000Z")).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe("formatDateSeparator", () => {
  const now = new Date("2026-06-12T12:00:00.000Z");

  it("returns I dag for same calendar day", () => {
    expect(formatDateSeparator("2026-06-12T08:00:00.000Z", now)).toBe("I dag");
  });

  it("returns I går for previous calendar day", () => {
    expect(formatDateSeparator("2026-06-11T08:00:00.000Z", now)).toBe("I går");
  });
});

describe("dateKey", () => {
  it("groups messages on same day", () => {
    expect(dateKey("2026-06-12T08:00:00.000Z")).toBe(dateKey("2026-06-12T20:00:00.000Z"));
  });
});
