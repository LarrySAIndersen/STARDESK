import { describe, expect, it } from "vitest";

import { canAccessPortalKnowledge, portalRoleLabel } from "./portal-access";
import type { User } from "@/types/user";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "test@example.dk",
    display_name: "Test User",
    role: "end_user",
    role_label: "Slutbruger",
    ...overrides,
  };
}

describe("portalRoleLabel", () => {
  it("shows Borger for end_user", () => {
    expect(portalRoleLabel(makeUser({ role: "end_user" }))).toBe("Borger");
  });

  it("shows Borger for external role labels", () => {
    expect(
      portalRoleLabel(makeUser({ role: "agent", role_label: "Ekstern bruger" })),
    ).toBe("Borger");
  });

  it("shows Sagsbehandler for agents", () => {
    expect(portalRoleLabel(makeUser({ role: "agent", role_label: "Agent" }))).toBe(
      "Sagsbehandler",
    );
  });

  it("shows administrator label for admin roles", () => {
    expect(
      portalRoleLabel(makeUser({ role: "admin", role_label: "IT Administrator" })),
    ).toBe("IT Administrator");
  });
});

describe("canAccessPortalKnowledge", () => {
  it("denies access when user is null", () => {
    expect(canAccessPortalKnowledge(null)).toBe(false);
  });

  it("allows end_user", () => {
    expect(canAccessPortalKnowledge(makeUser({ role: "end_user" }))).toBe(true);
  });

  it("allows external-labelled users", () => {
    expect(
      canAccessPortalKnowledge(makeUser({ role: "agent", role_label: "Ekstern partner" })),
    ).toBe(true);
  });

  it("denies regular staff without external label", () => {
    expect(canAccessPortalKnowledge(makeUser({ role: "agent", role_label: "Agent" }))).toBe(
      false,
    );
  });
});
