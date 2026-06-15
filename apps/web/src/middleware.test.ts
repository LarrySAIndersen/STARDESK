import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { TOKEN_COOKIE, USER_COOKIE } from "@/lib/auth";
import { middleware } from "@/middleware";

function makeRequest(
  pathname: string,
  options?: { token?: string; userCookie?: string; basicAuth?: string },
): NextRequest {
  const url = `http://localhost:3000${pathname}`;
  const headers = new Headers();
  if (options?.basicAuth) {
    headers.set("authorization", options.basicAuth);
  }
  const request = new NextRequest(url, { headers });
  if (options?.token) {
    request.cookies.set(TOKEN_COOKIE, options.token);
  }
  if (options?.userCookie) {
    request.cookies.set(USER_COOKIE, options.userCookie);
  }
  return request;
}

describe("middleware JWT session", () => {
  const originalBasicUser = process.env.BASIC_AUTH_USER;
  const originalBasicPassword = process.env.BASIC_AUTH_PASSWORD;

  beforeEach(() => {
    delete process.env.BASIC_AUTH_USER;
    delete process.env.BASIC_AUTH_PASSWORD;
  });

  afterEach(() => {
    process.env.BASIC_AUTH_USER = originalBasicUser;
    process.env.BASIC_AUTH_PASSWORD = originalBasicPassword;
  });

  it("allows public login and portal paths without token", () => {
    for (const path of ["/", "/portal", "/login"]) {
      const response = middleware(makeRequest(path));
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    }
  });

  it("redirects protected staff routes to login when unauthenticated", () => {
    const response = middleware(makeRequest("/tickets"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("redirects protected portal subpaths to /portal when unauthenticated", () => {
    const response = middleware(makeRequest("/portal/mine-sager"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/portal");
  });

  it("passes through protected routes when token cookie is present", () => {
    const response = middleware(makeRequest("/tickets", { token: "jwt-token" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("passes through API proxy without redirect", () => {
    const response = middleware(makeRequest("/api/proxy/v1/tickets"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("passes through static public assets", () => {
    const response = middleware(makeRequest("/images/logo.svg"));
    expect(response.status).toBe(200);
  });

  it("allows password-change exempt path without token", () => {
    const response = middleware(makeRequest("/skift-adgangskode"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("allows auth BFF routes without token", () => {
    const response = middleware(makeRequest("/api/auth/session"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-pathname")).toBeNull();
  });

  it("allows login subpaths without token", () => {
    const response = middleware(makeRequest("/login/forgot"));
    expect(response.status).toBe(200);
  });

  it("sets x-pathname header when authenticated request continues", () => {
    const response = middleware(makeRequest("/tickets", { token: "jwt-token" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-request-x-pathname")).toBe("/tickets");
  });

  it("redirects legacy /min-side for staff to personal workspace", () => {
    const userCookie = JSON.stringify({
      id: "user-1",
      role: "agent",
      roles: ["agent"],
      display_name: "Anna",
      email: "sf01@example.dk",
    });
    const response = middleware(
      makeRequest("/min-side", { token: "jwt-token", userCookie }),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/arbejdsrum?space=personal",
    );
  });

  it("passes /min-side through when user cookie is missing", () => {
    const response = middleware(makeRequest("/min-side", { token: "jwt-token" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("middleware Basic Auth staging lock", () => {
  const originalBasicUser = process.env.BASIC_AUTH_USER;
  const originalBasicPassword = process.env.BASIC_AUTH_PASSWORD;

  beforeEach(() => {
    process.env.BASIC_AUTH_USER = "staging";
    process.env.BASIC_AUTH_PASSWORD = "secret";
  });

  afterEach(() => {
    process.env.BASIC_AUTH_USER = originalBasicUser;
    process.env.BASIC_AUTH_PASSWORD = originalBasicPassword;
  });

  it("returns 401 when Basic Auth is enabled and credentials are missing", () => {
    const response = middleware(makeRequest("/reports"));
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Basic");
  });

  it("allows request when valid Basic Auth header is supplied", () => {
    const encoded = Buffer.from("staging:secret").toString("base64");
    const response = middleware(
      makeRequest("/reports", { basicAuth: `Basic ${encoded}`, token: "jwt" }),
    );
    expect(response.status).toBe(200);
  });

  it("skips Basic Auth for health and proxy API paths", () => {
    for (const path of ["/api/health", "/api/proxy/v1/me"]) {
      const response = middleware(makeRequest(path));
      expect(response.status).toBe(200);
    }
  });

  it("rejects invalid Basic Auth credentials", () => {
    const encoded = Buffer.from("staging:wrong").toString("base64");
    const response = middleware(makeRequest("/reports", { basicAuth: `Basic ${encoded}` }));
    expect(response.status).toBe(401);
  });

  it("skips Basic Auth for favicon", () => {
    const response = middleware(makeRequest("/favicon.ico"));
    expect(response.status).toBe(200);
  });
});
