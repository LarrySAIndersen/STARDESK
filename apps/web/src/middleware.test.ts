import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { TOKEN_COOKIE } from "@/lib/auth";
import { middleware } from "@/middleware";

function makeRequest(
  pathname: string,
  options?: { token?: string; basicAuth?: string },
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
});
