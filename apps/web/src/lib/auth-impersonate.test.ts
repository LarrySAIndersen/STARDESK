import { describe, expect, it } from "vitest";

import { canImpersonateUsers, isImpersonating, isAdmin } from "@/lib/auth";
import type { User } from "@/types/user";

const admin: User = {
  id: "1",
  email: "admin@example.dk",
  display_name: "Admin",
  role: "admin",
  role_label: "Administrator",
};

const impersonatedAgent: User = {
  id: "2",
  email: "anna@example.dk",
  display_name: "Anna",
  role: "agent",
  role_label: "Agent",
  impersonator: {
    id: "1",
    email: "admin@example.dk",
    display_name: "Admin",
  },
};

describe("impersonation helpers", () => {
  it("allows admins who are not impersonating", () => {
    expect(isAdmin(admin)).toBe(true);
    expect(canImpersonateUsers(admin)).toBe(true);
  });

  it("blocks impersonate button while impersonating", () => {
    expect(isImpersonating(impersonatedAgent)).toBe(true);
    expect(canImpersonateUsers(impersonatedAgent)).toBe(false);
  });
});
