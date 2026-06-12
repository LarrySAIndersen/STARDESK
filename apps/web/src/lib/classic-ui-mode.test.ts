import { describe, expect, it } from "vitest";

import {
  UI_MODE_COOKIE,
  canChooseClassicUi,
  canChooseModernUi,
  canChooseUiMode,
  classicHomePath,
  isClassicOnlyUser,
  isModernOnlyUser,
  isModernStaffPath,
  modernHomePath,
  parseUiMode,
  resolveEffectiveUiMode,
  staffLandingPath,
} from "./classic-ui-mode";
import type { User } from "@/types/user";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u1",
    email: "agent@example.dk",
    display_name: "Agent",
    role: "agent",
    role_label: "Agent",
    roles: ["agent", "admin"],
    ...overrides,
  };
}

describe("parseUiMode", () => {
  it("parses classic or defaults to modern", () => {
    expect(parseUiMode("classic")).toBe("classic");
    expect(parseUiMode("modern")).toBe("modern");
    expect(parseUiMode(null)).toBe("modern");
  });
});

describe("resolveEffectiveUiMode", () => {
  it("prefers DB lock over cookie", () => {
    expect(resolveEffectiveUiMode("classic", "modern")).toBe("classic");
    expect(resolveEffectiveUiMode(undefined, "classic")).toBe("classic");
  });
});

describe("ui mode lock helpers", () => {
  it("detects classic-only and modern-only users", () => {
    expect(isClassicOnlyUser("classic")).toBe(true);
    expect(isModernOnlyUser("modern")).toBe(true);
  });
});

describe("home paths", () => {
  it("exposes stable route constants", () => {
    expect(classicHomePath()).toBe("/classic");
    expect(modernHomePath()).toBe("/");
    expect(UI_MODE_COOKIE).toBe("stardesk_ui_mode");
  });
});

describe("canChooseUiMode", () => {
  it("allows staff admins to toggle UI mode", () => {
    expect(canChooseUiMode(makeUser())).toBe(true);
    expect(canChooseUiMode(makeUser({ role: "end_user", roles: ["end_user"] }))).toBe(false);
    expect(canChooseClassicUi(makeUser({ ui_mode: "classic" }))).toBe(false);
    expect(canChooseModernUi(makeUser({ ui_mode: "modern" }))).toBe(false);
  });
});

describe("staffLandingPath", () => {
  it("routes classic staff to classic home", () => {
    expect(staffLandingPath(makeUser({ ui_mode: "classic" }))).toBe("/classic");
    expect(staffLandingPath(makeUser(), "classic")).toBe("/classic");
    expect(staffLandingPath(makeUser())).toBe("/");
    expect(staffLandingPath(null)).toBe("/");
  });
});

describe("isModernStaffPath", () => {
  it("classifies staff paths outside classic shell", () => {
    expect(isModernStaffPath("/tickets")).toBe(true);
    expect(isModernStaffPath("/classic/incidents")).toBe(false);
    expect(isModernStaffPath("/portal")).toBe(false);
    expect(isModernStaffPath("/skift-adgangskode")).toBe(false);
  });
});
