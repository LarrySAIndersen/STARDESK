import { describe, expect, it } from "vitest";

import { canEditPageLayout } from "./access";
import { SOLE_TOP_ADMIN_EMAIL } from "@/lib/top-admin";
import type { User } from "@/types/user";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u1",
    email: "user@example.dk",
    display_name: "User",
    role: "agent",
    role_label: "Agent",
    ...overrides,
  };
}

describe("canEditPageLayout", () => {
  it("denies when user is null", () => {
    expect(canEditPageLayout(null)).toBe(false);
  });

  it("allows sole top admin and top_admin role", () => {
    expect(canEditPageLayout(makeUser({ email: SOLE_TOP_ADMIN_EMAIL, role: "agent" }))).toBe(
      true,
    );
    expect(canEditPageLayout(makeUser({ role: "top_admin", roles: ["top_admin"] }))).toBe(true);
  });

  it("allows admin roles", () => {
    expect(canEditPageLayout(makeUser({ role: "admin", roles: ["admin"] }))).toBe(true);
  });

  it("denies regular agents", () => {
    expect(canEditPageLayout(makeUser({ role: "agent", roles: ["agent"] }))).toBe(false);
  });
});
