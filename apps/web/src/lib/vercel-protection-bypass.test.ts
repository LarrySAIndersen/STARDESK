import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { vercelProtectionBypassHeaders } from "./vercel-protection-bypass";

describe("vercelProtectionBypassHeaders", () => {
  const originalAutomation = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const originalBypass = process.env.VERCEL_PROTECTION_BYPASS;

  beforeEach(() => {
    delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    delete process.env.VERCEL_PROTECTION_BYPASS;
  });

  afterEach(() => {
    if (originalAutomation === undefined) {
      delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    } else {
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET = originalAutomation;
    }
    if (originalBypass === undefined) {
      delete process.env.VERCEL_PROTECTION_BYPASS;
    } else {
      process.env.VERCEL_PROTECTION_BYPASS = originalBypass;
    }
  });

  it("returns empty object when no secret is configured", () => {
    expect(vercelProtectionBypassHeaders()).toEqual({});
  });

  it("prefers VERCEL_AUTOMATION_BYPASS_SECRET", () => {
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = "auto-secret";
    process.env.VERCEL_PROTECTION_BYPASS = "legacy";
    expect(vercelProtectionBypassHeaders()).toEqual({
      "x-vercel-protection-bypass": "auto-secret",
    });
  });

  it("falls back to VERCEL_PROTECTION_BYPASS", () => {
    process.env.VERCEL_PROTECTION_BYPASS = "legacy-secret";
    expect(vercelProtectionBypassHeaders()).toEqual({
      "x-vercel-protection-bypass": "legacy-secret",
    });
  });
});
