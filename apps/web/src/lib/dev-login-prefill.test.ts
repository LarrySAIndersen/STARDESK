import { afterEach, describe, expect, it } from "vitest";

import { getDevLoginPrefill } from "./dev-login-prefill";

const ENV_KEYS = [
  "NEXT_PUBLIC_STARDESK_ENV",
  "NEXT_PUBLIC_DEV_LOGIN_PREFILL_EMAIL",
  "NEXT_PUBLIC_DEV_LOGIN_PREFILL_PASSWORD",
  "NEXT_PUBLIC_PROTOTYPE_BOOTSTRAP_PASSWORD",
] as const;

const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof ENV_KEYS)[number], string | undefined>;

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("getDevLoginPrefill", () => {
  it("returns null in production stardesk env", () => {
    process.env.NEXT_PUBLIC_STARDESK_ENV = "production";
    process.env.NEXT_PUBLIC_DEV_LOGIN_PREFILL_EMAIL = "larrysanders@example.dk";
    process.env.NEXT_PUBLIC_PROTOTYPE_BOOTSTRAP_PASSWORD = "Stardesk2026!";

    expect(getDevLoginPrefill()).toBeNull();
  });

  it("returns null when prefill email is unset", () => {
    process.env.NEXT_PUBLIC_STARDESK_ENV = "development";
    delete process.env.NEXT_PUBLIC_DEV_LOGIN_PREFILL_EMAIL;
    process.env.NEXT_PUBLIC_PROTOTYPE_BOOTSTRAP_PASSWORD = "Stardesk2026!";

    expect(getDevLoginPrefill()).toBeNull();
  });

  it("uses bootstrap password when prefill password is omitted", () => {
    process.env.NEXT_PUBLIC_STARDESK_ENV = "test";
    process.env.NEXT_PUBLIC_DEV_LOGIN_PREFILL_EMAIL = "larrysanders@example.dk";
    delete process.env.NEXT_PUBLIC_DEV_LOGIN_PREFILL_PASSWORD;
    process.env.NEXT_PUBLIC_PROTOTYPE_BOOTSTRAP_PASSWORD = "Stardesk2026!";

    expect(getDevLoginPrefill()).toEqual({
      email: "larrysanders@example.dk",
      password: "Stardesk2026!",
    });
  });

  it("prefers explicit prefill password when set", () => {
    process.env.NEXT_PUBLIC_STARDESK_ENV = "development";
    process.env.NEXT_PUBLIC_DEV_LOGIN_PREFILL_EMAIL = "larrysanders@example.dk";
    process.env.NEXT_PUBLIC_DEV_LOGIN_PREFILL_PASSWORD = "override";
    process.env.NEXT_PUBLIC_PROTOTYPE_BOOTSTRAP_PASSWORD = "Stardesk2026!";

    expect(getDevLoginPrefill()).toEqual({
      email: "larrysanders@example.dk",
      password: "override",
    });
  });
});
