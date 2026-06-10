import { describe, expect, it } from "vitest";

import {
  MUST_CHANGE_PASSWORD_DETAIL,
  MUST_CHANGE_PASSWORD_MESSAGE,
  MUTATION_FORBIDDEN_MESSAGE,
  apiErrorMessage,
  isMustChangePasswordError,
  parseApiErrorDetail,
} from "./api-errors";

function mockResponse(
  status: number,
  body: string,
  contentType = "application/json",
): Response {
  return new Response(body, {
    status,
    headers: { "content-type": contentType },
  });
}

describe("isMustChangePasswordError", () => {
  it("returns true for 403 with must_change_password detail", () => {
    expect(isMustChangePasswordError(403, MUST_CHANGE_PASSWORD_DETAIL)).toBe(true);
  });

  it("returns false for other status or detail", () => {
    expect(isMustChangePasswordError(401, MUST_CHANGE_PASSWORD_DETAIL)).toBe(false);
    expect(isMustChangePasswordError(403, "forbidden")).toBe(false);
  });
});

describe("apiErrorMessage", () => {
  it("maps must_change_password to neutral mutation message", () => {
    expect(apiErrorMessage(MUST_CHANGE_PASSWORD_DETAIL)).toBe(MUTATION_FORBIDDEN_MESSAGE);
  });

  it("passes through other detail strings", () => {
    expect(apiErrorMessage("Sag ikke fundet")).toBe("Sag ikke fundet");
  });
});

describe("parseApiErrorDetail", () => {
  it("extracts string detail from JSON body", async () => {
    const response = mockResponse(400, JSON.stringify({ detail: "Ugyldig input" }));
    await expect(parseApiErrorDetail(response)).resolves.toBe("Ugyldig input");
  });

  it("extracts title from RFC7807-style detail object", async () => {
    const response = mockResponse(
      422,
      JSON.stringify({ detail: { title: "Valideringsfejl" } }),
    );
    await expect(parseApiErrorDetail(response)).resolves.toBe("Valideringsfejl");
  });

  it("detects Vercel deployment protection HTML", async () => {
    const html =
      "<!DOCTYPE html><html><body>Authentication required for Vercel</body></html>";
    const response = mockResponse(401, html, "text/html");
    await expect(parseApiErrorDetail(response)).resolves.toContain("Deployment-beskyttelse");
  });

  it("maps plain Authentication required text", async () => {
    const response = mockResponse(401, "Authentication required", "text/plain");
    await expect(parseApiErrorDetail(response)).resolves.toBe(
      "HTTP Basic Auth kræves for dette miljø.",
    );
  });

  it("returns short plain-text bodies verbatim", async () => {
    const response = mockResponse(503, "Service unavailable", "text/plain");
    await expect(parseApiErrorDetail(response)).resolves.toBe("Service unavailable");
  });

  it("falls back to generic API-fejl for unreadable bodies", async () => {
    const response = mockResponse(500, "<html><body>error</body></html>", "text/html");
    await expect(parseApiErrorDetail(response)).resolves.toBe("API-fejl: 500");
  });
});

describe("must-change-password constants", () => {
  it("exposes Danish first-login message for redirect copy", () => {
    expect(MUST_CHANGE_PASSWORD_MESSAGE).toContain("skifte adgangskode");
  });
});
