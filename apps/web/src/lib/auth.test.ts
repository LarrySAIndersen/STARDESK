import { describe, expect, it } from "vitest";

import {
  hasAgentShellAccess,
  isAdmin,
  isStaff,
  isSubmitter,
  normalizeUserRole,
  parseUserFromCookie,
  resolveUserRole,
  resolveUserRoles,
} from "./auth";
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

describe("normalizeUserRole", () => {
  it("maps Danish and spaced role labels to canonical roles", () => {
    expect(normalizeUserRole("Slutbruger")).toBe("end_user");
    expect(normalizeUserRole("TopAdministrator")).toBe("top_admin");
    expect(normalizeUserRole("kundeportal 2")).toBe("kundeportal_2");
    expect(normalizeUserRole("kundeportal_2")).toBe("kundeportal_2");
    expect(normalizeUserRole("stardesk reviewer")).toBe("stardesk_reviewer");
  });

  it("returns null for unknown roles", () => {
    expect(normalizeUserRole("unknown")).toBeNull();
    expect(normalizeUserRole(undefined)).toBeNull();
  });
});

describe("resolveUserRoles", () => {
  it("prefers roles array when present", () => {
    const user = makeUser({
      role: "end_user",
      roles: ["agent", "admin"],
    });
    expect(resolveUserRoles(user)).toEqual(["agent", "admin"]);
  });

  it("falls back to single role field", () => {
    const user = makeUser({ role: "supporter", roles: undefined });
    expect(resolveUserRoles(user)).toEqual(["supporter"]);
  });
});

describe("resolveUserRole", () => {
  it("returns highest-priority role from roles array", () => {
    const user = makeUser({
      roles: ["end_user", "admin"],
    });
    expect(resolveUserRole(user)).toBe("admin");
  });
});

describe("parseUserFromCookie", () => {
  it("parses plain JSON cookie payload", () => {
    const user = makeUser({ email: "anna@example.dk", role: "agent" });
    const parsed = parseUserFromCookie(JSON.stringify(user));
    expect(parsed?.email).toBe("anna@example.dk");
    expect(parsed?.role).toBe("agent");
  });

  it("parses URI-encoded cookie payload", () => {
    const user = makeUser({ email: "borger@example.dk", role: "end_user" });
    const encoded = encodeURIComponent(JSON.stringify(user));
    const parsed = parseUserFromCookie(encoded);
    expect(parsed?.email).toBe("borger@example.dk");
  });

  it("returns null for invalid or empty input", () => {
    expect(parseUserFromCookie(null)).toBeNull();
    expect(parseUserFromCookie("not-json")).toBeNull();
    expect(parseUserFromCookie(JSON.stringify({ display_name: "No email" }))).toBeNull();
  });
});

describe("role guards", () => {
  it("isStaff is true for agent, admin, top_admin, supporter", () => {
    expect(isStaff(makeUser({ role: "agent" }))).toBe(true);
    expect(isStaff(makeUser({ role: "end_user" }))).toBe(false);
    expect(isStaff(null)).toBe(false);
  });

  it("isAdmin respects role_labels administrator hints", () => {
    expect(isAdmin(makeUser({ role: "agent", role_label: "Administrator" }))).toBe(true);
  });

  it("isSubmitter detects end_user role", () => {
    expect(isSubmitter(makeUser({ role: "end_user" }))).toBe(true);
  });

  it("hasAgentShellAccess includes stardesk_reviewer", () => {
    expect(hasAgentShellAccess(makeUser({ role: "stardesk_reviewer" }))).toBe(true);
    expect(hasAgentShellAccess(makeUser({ role: "end_user" }))).toBe(false);
  });
});
