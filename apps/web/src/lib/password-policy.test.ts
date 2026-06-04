import { describe, it, expect } from "vitest";
import { validatePassword, PASSWORD_VALIDATION_MESSAGE } from "./password-policy";

describe("password-policy", () => {
  it("should return null for valid passwords", () => {
    expect(validatePassword("Stardesk2026")).toBeNull();
    expect(validatePassword("abcde123")).toBeNull();
  });

  it("should return validation message for passwords that are too short", () => {
    expect(validatePassword("abc12")).toBe(PASSWORD_VALIDATION_MESSAGE);
  });

  it("should return validation message for passwords with special characters", () => {
    expect(validatePassword("Stardesk2026!")).toBe(PASSWORD_VALIDATION_MESSAGE);
  });
});
