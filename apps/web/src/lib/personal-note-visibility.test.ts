import { describe, expect, it } from "vitest";

import {
  buildPostItAttachUpdate,
  personalNoteVisibilityLabel,
  trimmedNoteField,
} from "@/lib/personal-note-visibility";

describe("personal-note-visibility", () => {
  it("maps visibility to Danish labels", () => {
    expect(personalNoteVisibilityLabel("team")).toBe("Alle på sagen");
    expect(personalNoteVisibilityLabel("private")).toBe("Kun mig");
    expect(personalNoteVisibilityLabel(null)).toBe("Kun mig");
  });

  it("builds attach payload for ticket", () => {
    expect(buildPostItAttachUpdate("ticket-1", "team")).toEqual({
      ticket_id: "ticket-1",
      visibility: "team",
    });
  });

  it("returns trimmed fields only when changed and valid", () => {
    expect(trimmedNoteField("  Hej  ", "Hej")).toBeNull();
    expect(trimmedNoteField("  ", "title")).toBeNull();
    expect(trimmedNoteField("Ny titel", "Gammel")).toBe("Ny titel");
    expect(trimmedNoteField("", "indhold", 0)).toBe("");
  });
});
