import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getEnvironmentBannerContent,
  getEnvironmentShortLabel,
  getStardeskEnv,
  shouldShowEnvironmentBanner,
} from "./stardesk-env";

const ORIGINAL_ENV = { ...process.env };

function restoreEnv(): void {
  process.env = { ...ORIGINAL_ENV };
}

describe("getStardeskEnv", () => {
  beforeEach(() => {
    restoreEnv();
    delete process.env.NEXT_PUBLIC_STARDESK_ENV;
    delete process.env.VERCEL_ENV;
    delete process.env.NEXT_PUBLIC_VERCEL_ENV;
  });

  afterEach(() => {
    restoreEnv();
  });

  it("prefers NEXT_PUBLIC_STARDESK_ENV when valid", () => {
    process.env.NEXT_PUBLIC_STARDESK_ENV = "test";
    expect(getStardeskEnv()).toBe("test");
  });

  it("maps Vercel preview to test", () => {
    process.env.VERCEL_ENV = "preview";
    expect(getStardeskEnv()).toBe("test");
  });

  it("maps Vercel production to production", () => {
    process.env.VERCEL_ENV = "production";
    expect(getStardeskEnv()).toBe("production");
  });

  it("defaults to development in NODE_ENV development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(getStardeskEnv()).toBe("development");
    vi.unstubAllEnvs();
  });
});

describe("environment banner helpers", () => {
  beforeEach(() => {
    restoreEnv();
    process.env.NEXT_PUBLIC_STARDESK_ENV = "test";
  });

  afterEach(() => {
    restoreEnv();
  });

  it("always shows environment banner", () => {
    expect(shouldShowEnvironmentBanner()).toBe(true);
  });

  it("returns staging banner content for test env", () => {
    expect(getEnvironmentBannerContent()).toMatchObject({
      label: "STAGING · Preview",
    });
    expect(getEnvironmentShortLabel()).toBe("staging");
  });
});
