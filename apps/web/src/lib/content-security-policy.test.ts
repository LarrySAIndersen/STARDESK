import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy } from "@/lib/content-security-policy";

describe("buildContentSecurityPolicy", () => {
  it("includes core restrictive directives", () => {
    const policy = buildContentSecurityPolicy();

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("form-action 'self'");
  });

  it("allows same-origin scripts and inline styles required by Next.js", () => {
    const policy = buildContentSecurityPolicy();

    expect(policy).toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("allows embedded SBOM analyzer iframe", () => {
    const policy = buildContentSecurityPolicy();

    expect(policy).toContain("frame-src 'self' https://releaserun.com");
  });

  it("allows blob and data URLs for attachments and exports", () => {
    const policy = buildContentSecurityPolicy();

    expect(policy).toContain("img-src 'self' data: blob: https:");
    expect(policy).toContain("worker-src 'self' blob:");
  });

  it("adds upgrade-insecure-requests in production deploys", () => {
    const policy = buildContentSecurityPolicy({ isProductionDeploy: true });

    expect(policy).toContain("upgrade-insecure-requests");
  });

  it("omits upgrade-insecure-requests outside production deploys", () => {
    const policy = buildContentSecurityPolicy({ isProductionDeploy: false });

    expect(policy).not.toContain("upgrade-insecure-requests");
  });

  it("relaxes script and connect sources for local development", () => {
    const policy = buildContentSecurityPolicy({ isDevServer: true });

    expect(policy).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    expect(policy).toContain("http://localhost:8000");
    expect(policy).toContain("ws://localhost:3000");
  });
});
