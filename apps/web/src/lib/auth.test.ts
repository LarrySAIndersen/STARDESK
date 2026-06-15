import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  canExportTickets,
  canManageUsers,
  canViewImprovements,
  clearSession,
  getClientToken,
  getClientUser,
  hasAgentShellAccess,
  hydrateClientSession,
  isAdmin,
  isStaff,
  isStardeskReviewer,
  isSubmitter,
  isTopAdmin,
  normalizeUserRole,
  parseUserFromCookie,
  resolveUserRole,
  resolveUserRoles,
  setClientSessionCache,
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

  it("coerces roles array and password flags from cookie JSON", () => {
    const user = makeUser({
      email: "multi@example.dk",
      roles: ["agent", "admin"],
      must_change_password: true,
      password_policy_exempt: false,
    });
    const parsed = parseUserFromCookie(JSON.stringify(user));
    expect(parsed?.roles).toEqual(["agent", "admin"]);
    expect(parsed?.must_change_password).toBe(true);
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

  it("isStardeskReviewer detects reviewer role", () => {
    expect(isStardeskReviewer(makeUser({ role: "stardesk_reviewer" }))).toBe(true);
    expect(isStardeskReviewer(makeUser({ role: "agent" }))).toBe(false);
  });

  it("canManageUsers and canExportTickets follow admin/staff rules", () => {
    expect(canManageUsers(makeUser({ role: "admin" }))).toBe(true);
    expect(canManageUsers(makeUser({ role: "agent" }))).toBe(false);
    expect(canExportTickets(makeUser({ role: "agent" }))).toBe(true);
    expect(canExportTickets(makeUser({ role: "end_user" }))).toBe(false);
  });

  it("canViewImprovements is staff-only", () => {
    expect(canViewImprovements(makeUser({ role: "agent" }))).toBe(true);
    expect(canViewImprovements(makeUser({ role: "stardesk_reviewer" }))).toBe(false);
  });

  it("isTopAdmin delegates to nav visibility helper", () => {
    expect(isTopAdmin(makeUser({ role: "top_admin" }))).toBe(true);
    expect(isTopAdmin(makeUser({ role: "agent" }))).toBe(false);
  });
});

describe("client session cache", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setClientSessionCache(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    setClientSessionCache(null);
  });

  it("getClientToken is always null (HttpOnly cookies)", () => {
    expect(getClientToken()).toBeNull();
  });

  it("setClientSessionCache and getClientUser round-trip", () => {
    const user = makeUser({ email: "cache@example.dk" });
    setClientSessionCache(user);
    expect(getClientUser()?.email).toBe("cache@example.dk");
  });

  it("hydrateClientSession loads user from BFF session endpoint", async () => {
    vi.stubGlobal("window", {} as Window);
    const user = makeUser({ email: "hydrated@example.dk" });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ user }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(hydrateClientSession()).resolves.toEqual(user);
    expect(getClientUser()?.email).toBe("hydrated@example.dk");
  });

  it("hydrateClientSession clears cache and logs out on 401", async () => {
    vi.stubGlobal("window", {} as Window);
    setClientSessionCache(makeUser());
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await expect(hydrateClientSession()).resolves.toBeNull();
    expect(getClientUser()).toBeNull();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/auth/logout",
      expect.objectContaining({ method: "POST", credentials: "same-origin" }),
    );
  });

  it("clearSession posts logout and clears cache", async () => {
    vi.stubGlobal("window", {} as Window);
    setClientSessionCache(makeUser());
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await clearSession();
    expect(getClientUser()).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({ method: "POST", credentials: "same-origin" }),
    );
  });
});
