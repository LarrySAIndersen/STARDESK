import { describe, expect, it } from "vitest";

import { canAccessKundeportal2, kundeportal2RoleLabel } from "./kundeportal-2-access";
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

describe("canAccessKundeportal2", () => {
  it("allows any authenticated user", () => {
    expect(canAccessKundeportal2(makeUser())).toBe(true);
  });

  it("denies when user is null", () => {
    expect(canAccessKundeportal2(null)).toBe(false);
  });
});

describe("kundeportal2RoleLabel", () => {
  it("shows Kundeportal #2 for kundeportal_2 role", () => {
    expect(
      kundeportal2RoleLabel(makeUser({ roles: ["kundeportal_2"], role: "kundeportal_2" })),
    ).toBe("Kundeportal #2");
  });

  it("shows Borger for end_user", () => {
    expect(kundeportal2RoleLabel(makeUser({ role: "end_user", role_label: "Slutbruger" }))).toBe(
      "Borger",
    );
  });

  it("falls back to role_label or Bruger", () => {
    expect(kundeportal2RoleLabel(makeUser({ role: "agent", role_label: "Sagsbehandler" }))).toBe(
      "Sagsbehandler",
    );
    expect(kundeportal2RoleLabel(makeUser({ role: "agent", role_label: "" }))).toBe("Bruger");
  });
});
