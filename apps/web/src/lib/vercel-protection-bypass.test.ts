import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  apiUpstreamProtectionBypassHeaders,
  backendUpstreamHeaders,
  vercelProtectionBypassHeaders,
} from "./vercel-protection-bypass";

describe("apiUpstreamProtectionBypassHeaders", () => {
  const originalApiBypass = process.env.STARDESK_API_PROTECTION_BYPASS;
  const originalBypass = process.env.VERCEL_PROTECTION_BYPASS;
  const originalAutomation = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

  beforeEach(() => {
    delete process.env.STARDESK_API_PROTECTION_BYPASS;
    delete process.env.VERCEL_PROTECTION_BYPASS;
    delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  });

  afterEach(() => {
    if (originalApiBypass === undefined) {
      delete process.env.STARDESK_API_PROTECTION_BYPASS;
    } else {
      process.env.STARDESK_API_PROTECTION_BYPASS = originalApiBypass;
    }
    if (originalBypass === undefined) {
      delete process.env.VERCEL_PROTECTION_BYPASS;
    } else {
      process.env.VERCEL_PROTECTION_BYPASS = originalBypass;
    }
    if (originalAutomation === undefined) {
      delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    } else {
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET = originalAutomation;
    }
  });

  it("returns empty object when no API bypass secret is configured", () => {
    expect(apiUpstreamProtectionBypassHeaders()).toEqual({});
  });

  it("prefers STARDESK_API_PROTECTION_BYPASS", () => {
    process.env.STARDESK_API_PROTECTION_BYPASS = "api-secret";
    process.env.VERCEL_PROTECTION_BYPASS = "legacy";
    expect(apiUpstreamProtectionBypassHeaders()).toEqual({
      "x-vercel-protection-bypass": "api-secret",
    });
  });

  it("uses VERCEL_PROTECTION_BYPASS for upstream API calls", () => {
    process.env.VERCEL_PROTECTION_BYPASS = "legacy-secret";
    expect(apiUpstreamProtectionBypassHeaders()).toEqual({
      "x-vercel-protection-bypass": "legacy-secret",
    });
  });

  it("does not use VERCEL_AUTOMATION_BYPASS_SECRET (web-only token)", () => {
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = "web-auto-secret";
    expect(apiUpstreamProtectionBypassHeaders()).toEqual({});
  });

  it("vercelProtectionBypassHeaders aliases api upstream headers", () => {
    process.env.VERCEL_PROTECTION_BYPASS = "legacy-secret";
    expect(vercelProtectionBypassHeaders()).toEqual(
      apiUpstreamProtectionBypassHeaders(),
    );
  });
});

describe("backendUpstreamHeaders", () => {
  afterEach(() => {
    delete process.env.VERCEL_PROTECTION_BYPASS;
  });

  it("merges bypass secret with extra headers", () => {
    process.env.VERCEL_PROTECTION_BYPASS = "bypass-token";
    expect(
      backendUpstreamHeaders({
        Accept: "application/json",
        Authorization: "Bearer jwt",
      }),
    ).toEqual({
      "x-vercel-protection-bypass": "bypass-token",
      Accept: "application/json",
      Authorization: "Bearer jwt",
    });
  });
});
