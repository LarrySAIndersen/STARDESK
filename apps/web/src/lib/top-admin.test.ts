import { describe, expect, it } from "vitest";

import {
  SOLE_TOP_ADMIN_EMAIL,
  canManageNavVisibility,
  isSoleTopAdminEmail,
} from "./top-admin";
import type { User } from "@/types/user";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u1",
    email: "agent@example.dk",
    display_name: "Agent",
    role: "agent",
    role_label: "Agent",
    ...overrides,
  };
}

describe("isSoleTopAdminEmail", () => {
  it("matches reserved owner email case-insensitively", () => {
    expect(isSoleTopAdminEmail(SOLE_TOP_ADMIN_EMAIL)).toBe(true);
    expect(isSoleTopAdminEmail("  LarrySanders@Example.dk ")).toBe(true);
    expect(isSoleTopAdminEmail("other@example.dk")).toBe(false);
    expect(isSoleTopAdminEmail(null)).toBe(false);
  });
});

describe("canManageNavVisibility", () => {
  it("allows top_admin role and sole owner email", () => {
    expect(canManageNavVisibility(makeUser({ role: "top_admin" }))).toBe(true);
    expect(canManageNavVisibility(makeUser({ email: SOLE_TOP_ADMIN_EMAIL }))).toBe(true);
    expect(canManageNavVisibility(makeUser({ role: "agent" }))).toBe(false);
    expect(canManageNavVisibility(null)).toBe(false);
  });
});
