import { describe, expect, it } from "vitest";

import { formatIntegrationError } from "./format-integration-error";

describe("formatIntegrationError", () => {
  it("returns default for empty message", () => {
    expect(formatIntegrationError("")).toContain("ukendt fejl");
  });

  it("maps organisation errors", () => {
    expect(formatIntegrationError("Bruger ikke knyttet til en organisation")).toContain(
      "organisationstilknytning",
    );
    expect(formatIntegrationError("Ingen aktiv organisation fundet")).toContain("organisation");
  });

  it("maps OAuth configuration errors", () => {
    expect(formatIntegrationError("OAuth mangler konfiguration")).toContain("SLACK_CLIENT_ID");
    expect(formatIntegrationError("oauth_start_failed")).toContain("OAuth");
  });

  it("maps auth errors and passes through admin messages", () => {
    expect(formatIntegrationError("not_authenticated")).toContain("logget ind");
    expect(formatIntegrationError("Kun administratorer må forbinde Slack")).toBe(
      "Kun administratorer må forbinde Slack",
    );
  });

  it("returns unknown messages unchanged", () => {
    expect(formatIntegrationError("Custom upstream error")).toBe("Custom upstream error");
  });
});
