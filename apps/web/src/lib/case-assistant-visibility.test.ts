import { describe, expect, it } from "vitest";

import {
  shouldMountCaseAssistant,
  showCaseAssistantOnPath,
} from "@/lib/case-assistant-visibility";
import type { User } from "@/types/user";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "test@example.dk",
    display_name: "Test User",
    role: "agent",
    role_label: "Agent",
    ...overrides,
  };
}

describe("case-assistant-visibility", () => {
  it("allows portal assistant paths for end users", () => {
    expect(showCaseAssistantOnPath("/portal")).toBe(true);
    expect(showCaseAssistantOnPath("/portal/tickets")).toBe(true);
    expect(showCaseAssistantOnPath("/sitemap")).toBe(false);
  });

  it("mounts the assistant on agent-shell pages for staff and reviewers", () => {
    expect(shouldMountCaseAssistant(makeUser({ role: "agent" }), "/sitemap")).toBe(true);
    expect(
      shouldMountCaseAssistant(makeUser({ role: "stardesk_reviewer" }), "/sitemap"),
    ).toBe(true);
  });

  it("keeps end-user home on the inline assistant card", () => {
    expect(shouldMountCaseAssistant(makeUser({ role: "end_user" }), "/")).toBe(false);
  });
});
