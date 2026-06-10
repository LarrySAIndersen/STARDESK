import { describe, expect, it } from "vitest";

import {
  CHANGE_PASSWORD_PATH,
  isPasswordChangeExemptPath,
  userForSessionCookie,
  userMustChangePassword,
} from "./must-change-password";
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

describe("userMustChangePassword", () => {
  it("returns true when must_change_password is set", () => {
    expect(userMustChangePassword(makeUser({ must_change_password: true }))).toBe(true);
  });

  it("returns false when password_policy_exempt is set", () => {
    expect(
      userMustChangePassword(
        makeUser({ must_change_password: true, password_policy_exempt: true }),
      ),
    ).toBe(false);
  });

  it("returns false for null user", () => {
    expect(userMustChangePassword(null)).toBe(false);
  });
});

describe("userForSessionCookie", () => {
  it("strips avatar_url and normalizes flags", () => {
    const user = makeUser({
      avatar_url: "data:image/png;base64,abc",
      must_change_password: true,
      password_policy_exempt: false,
    });
    const cookieUser = userForSessionCookie(user);
    expect(cookieUser.avatar_url).toBeNull();
    expect(cookieUser.must_change_password).toBe(true);
  });
});

describe("isPasswordChangeExemptPath", () => {
  it("allows change-password page and auth BFF routes", () => {
    expect(isPasswordChangeExemptPath(CHANGE_PASSWORD_PATH)).toBe(true);
    expect(isPasswordChangeExemptPath("/api/auth/session")).toBe(true);
  });

  it("denies regular app routes", () => {
    expect(isPasswordChangeExemptPath("/tickets")).toBe(false);
    expect(isPasswordChangeExemptPath("/portal")).toBe(false);
  });
});
