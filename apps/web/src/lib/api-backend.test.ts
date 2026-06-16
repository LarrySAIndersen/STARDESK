import { afterEach, describe, expect, it } from "vitest";

import {
  getApiBackendBase,
  getApiBackendFallbackBase,
  isProtectedStagingApiHost,
  shouldFallbackAuthUpstream,
  shouldFallbackServerUpstream,
  VERCEL_PROTOTYPE_API_FALLBACK,
  VERCEL_STAGING_API_FALLBACK,
} from "@/lib/api-backend";

const ENV_KEYS = [
  "APP_ENV",
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_STARDESK_ENV",
  "NEXT_PUBLIC_VERCEL_ENV",
  "STARDESK_API_URL",
  "STARDESK_ENV",
  "STARDESK_PREVIEW_USE_PROD_API",
  "STARDESK_USE_STAGING_API",
  "VERCEL",
  "VERCEL_ENV",
  "VERCEL_PROTECTION_BYPASS",
  "VERCEL_AUTOMATION_BYPASS_SECRET",
  "VERCEL_URL",
] as const;

describe("api-backend", () => {
  afterEach(() => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
  });

  it("uses configured API URL first", () => {
    process.env.STARDESK_API_URL = "https://api.example.test/";

    expect(getApiBackendBase()).toBe("https://api.example.test");
  });

  it("detects protected staging API hosts", () => {
    expect(isProtectedStagingApiHost(VERCEL_STAGING_API_FALLBACK)).toBe(true);
    expect(isProtectedStagingApiHost(VERCEL_PROTOTYPE_API_FALLBACK)).toBe(false);
  });

  it("uses staging API on Vercel preview when explicitly enabled", () => {
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "preview";
    process.env.NEXT_PUBLIC_API_URL = VERCEL_PROTOTYPE_API_FALLBACK;
    process.env.VERCEL_PROTECTION_BYPASS = "api-bypass-token";
    process.env.STARDESK_USE_STAGING_API = "true";

    expect(getApiBackendBase()).toBe(VERCEL_STAGING_API_FALLBACK);
  });

  it("uses production API when bypass is set but STARDESK_USE_STAGING_API is not", () => {
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "preview";
    process.env.NEXT_PUBLIC_STARDESK_ENV = "test";
    process.env.NEXT_PUBLIC_API_URL = VERCEL_STAGING_API_FALLBACK;
    process.env.VERCEL_PROTECTION_BYPASS = "api-bypass-token";

    expect(getApiBackendBase()).toBe(VERCEL_PROTOTYPE_API_FALLBACK);
  });

  it("honours STARDESK_API_URL on Vercel preview when staging is enabled", () => {
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "preview";
    process.env.NEXT_PUBLIC_API_URL = VERCEL_PROTOTYPE_API_FALLBACK;
    process.env.STARDESK_API_URL = "https://api-custom-staging.example.test/";
    process.env.VERCEL_PROTECTION_BYPASS = "api-bypass-token";
    process.env.STARDESK_USE_STAGING_API = "true";

    expect(getApiBackendBase()).toBe("https://api-custom-staging.example.test");
  });

  it("falls back to production when NEXT_PUBLIC_API_URL is staging but bypass is missing", () => {
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "preview";
    process.env.NEXT_PUBLIC_STARDESK_ENV = "test";
    process.env.NEXT_PUBLIC_API_URL = VERCEL_STAGING_API_FALLBACK;

    expect(getApiBackendBase()).toBe(VERCEL_PROTOTYPE_API_FALLBACK);
  });

  it("falls back to production API on test env when API bypass token is missing", () => {
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_STARDESK_ENV = "test";
    process.env.NEXT_PUBLIC_API_URL = VERCEL_PROTOTYPE_API_FALLBACK;
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = "web-only-token";

    expect(getApiBackendBase()).toBe(VERCEL_PROTOTYPE_API_FALLBACK);
  });

  it("uses production API by default on test preview without STARDESK_USE_STAGING_API", () => {
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_STARDESK_ENV = "test";
    process.env.VERCEL_PROTECTION_BYPASS = "api-bypass-token";

    expect(getApiBackendBase()).toBe(VERCEL_PROTOTYPE_API_FALLBACK);
  });

  it("getApiBackendFallbackBase prefers non-staging NEXT_PUBLIC_API_URL", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api-custom.example.test/";
    expect(getApiBackendFallbackBase()).toBe("https://api-custom.example.test");
  });

  it("uses production API for real production deployments", () => {
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_STARDESK_ENV = "production";

    expect(getApiBackendBase()).toBe(VERCEL_PROTOTYPE_API_FALLBACK);
  });
});

describe("shouldFallbackAuthUpstream", () => {
  it("retries when protected staging API returns server error", () => {
    const upstream = new Response("error", {
      status: 500,
      headers: { "content-type": "application/json" },
    });
    expect(
      shouldFallbackAuthUpstream(
        upstream,
        VERCEL_STAGING_API_FALLBACK,
        VERCEL_PROTOTYPE_API_FALLBACK,
      ),
    ).toBe(true);
  });
});

describe("shouldFallbackServerUpstream", () => {
  it("retries /me when staging rejects prod JWT", () => {
    const upstream = new Response(null, { status: 401 });
    expect(
      shouldFallbackServerUpstream(
        upstream,
        VERCEL_STAGING_API_FALLBACK,
        VERCEL_PROTOTYPE_API_FALLBACK,
      ),
    ).toBe(true);
  });
});
