import { describe, expect, it } from "vitest";

import { cn, displayNameInitials, formatDateTimeDa } from "./utils";

describe("cn", () => {
  it("merges tailwind classes", () => {
    expect(cn("px-2", "px-4", false && "hidden")).toBe("px-4");
  });
});

describe("displayNameInitials", () => {
  it("returns up to two uppercase initials", () => {
    expect(displayNameInitials("Anna Borger")).toBe("AB");
    expect(displayNameInitials("  X  ")).toBe("X");
    expect(displayNameInitials("")).toBe("?");
  });
});

describe("formatDateTimeDa", () => {
  it("formats valid ISO timestamps in da-DK", () => {
    const formatted = formatDateTimeDa("2026-06-10T12:00:00.000Z");
    expect(formatted).not.toBe("—");
    expect(formatted).toMatch(/2026/);
  });

  it("returns em dash for empty or invalid input", () => {
    expect(formatDateTimeDa(null)).toBe("—");
    expect(formatDateTimeDa("not-a-date")).toBe("—");
  });
});
