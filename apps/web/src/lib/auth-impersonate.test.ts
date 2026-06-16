import { describe, expect, it } from "vitest";

import {
  canImpersonateUsers,
  isAdministratorRightsGroupMember,
  isImpersonating,
} from "@/lib/auth";
import type { User } from "@/types/user";

const admin: User = {
  id: "1",
  email: "admin@example.dk",
  display_name: "Admin",
  role: "admin",
  role_label: "Administrator",
};

const topAdmin: User = {
  id: "2",
  email: "top@example.dk",
  display_name: "Top",
  role: "top_admin",
  role_label: "Topadministrator",
};

const supporter: User = {
  id: "3",
  email: "supporter@example.dk",
  display_name: "Support",
  role: "supporter",
  role_label: "Supporter",
};

const agentWithMisleadingLabel: User = {
  id: "4",
  email: "agent@example.dk",
  display_name: "Agent",
  role: "agent",
  role_label: "Agent",
  role_labels: ["Administrator"],
};

const impersonatedAgent: User = {
  id: "5",
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
  it("allows administrator rettighedsgruppe members", () => {
    expect(isAdministratorRightsGroupMember(admin)).toBe(true);
    expect(isAdministratorRightsGroupMember(topAdmin)).toBe(true);
    expect(canImpersonateUsers(admin)).toBe(true);
    expect(canImpersonateUsers(topAdmin)).toBe(true);
  });

  it("blocks supporters and agents without admin/top_admin role", () => {
    expect(isAdministratorRightsGroupMember(supporter)).toBe(false);
    expect(isAdministratorRightsGroupMember(agentWithMisleadingLabel)).toBe(false);
    expect(canImpersonateUsers(supporter)).toBe(false);
    expect(canImpersonateUsers(agentWithMisleadingLabel)).toBe(false);
  });

  it("blocks impersonate button while impersonating", () => {
    expect(isImpersonating(impersonatedAgent)).toBe(true);
    expect(canImpersonateUsers(impersonatedAgent)).toBe(false);
  });
});
