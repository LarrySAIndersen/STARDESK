import { describe, expect, it } from "vitest";

import { firstName } from "@/lib/display-name";
import { reviewNoteRoleColor } from "@/lib/review-note-role-colors";

describe("review note role colors", () => {
  it("maps known roles", () => {
    expect(reviewNoteRoleColor("stardesk_reviewer").label).toBe("Stardesk Reviewer");
    expect(reviewNoteRoleColor("admin").label).toBe("Administrator");
  });

  it("falls back for unknown role", () => {
    expect(reviewNoteRoleColor("unknown").label).toBe("Agent");
  });
});

describe("firstName", () => {
  it("returns first token only", () => {
    expect(firstName("Anna Agent")).toBe("Anna");
    expect(firstName("  Lars  ")).toBe("Lars");
  });
});
