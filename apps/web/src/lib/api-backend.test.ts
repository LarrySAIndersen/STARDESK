import { afterEach, describe, expect, it } from "vitest";

import {
  getApiBackendBase,
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
  "VERCEL",
  "VERCEL_ENV",
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

  it("keeps custom-domain staging on the staging API", () => {
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_STARDESK_ENV = "test";

    expect(getApiBackendBase()).toBe(VERCEL_STAGING_API_FALLBACK);
  });

  it("uses production API for real production deployments", () => {
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_STARDESK_ENV = "production";

    expect(getApiBackendBase()).toBe(VERCEL_PROTOTYPE_API_FALLBACK);
  });
});
