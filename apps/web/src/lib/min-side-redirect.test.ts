import { describe, expect, it } from "vitest";

import { resolveMinSideRedirectTarget } from "@/lib/min-side-redirect";

const staffUserCookie = JSON.stringify({
  id: "user-1",
  role: "agent",
  roles: ["agent"],
  display_name: "Anna",
  email: "sf01@example.dk",
});

const portalUserCookie = JSON.stringify({
  id: "user-2",
  role: "end_user",
  roles: ["end_user"],
  display_name: "Borger",
  email: "borger@example.dk",
});

describe("resolveMinSideRedirectTarget", () => {
  it("ignores non-min-side paths", () => {
    expect(resolveMinSideRedirectTarget("/tickets", "token", staffUserCookie)).toBeNull();
  });

  it("redirects unauthenticated visitors to home", () => {
    expect(resolveMinSideRedirectTarget("/min-side", undefined, undefined)).toBe("/");
  });

  it("defers to RSC when token exists without user cookie", () => {
    expect(resolveMinSideRedirectTarget("/min-side", "jwt", undefined)).toBeNull();
  });

  it("redirects staff to personal workspace", () => {
    expect(resolveMinSideRedirectTarget("/min-side", "jwt", staffUserCookie)).toBe(
      "/arbejdsrum?space=personal",
    );
  });

  it("redirects portal users to home", () => {
    expect(resolveMinSideRedirectTarget("/min-side", "jwt", portalUserCookie)).toBe("/");
  });
});
