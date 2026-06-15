/**
 * Server-side calls from web → protected Preview API deployments.
 * See docs/staging-vercel-preview-env.md and Vercel "Protection Bypass for Automation".
 */
export function vercelProtectionBypassHeaders(): Record<string, string> {
  const secret =
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim() ||
    process.env.VERCEL_PROTECTION_BYPASS?.trim();
  if (!secret) {
    return {};
  }
  return { "x-vercel-protection-bypass": secret };
}

/** Merge Vercel protection bypass with optional upstream headers (auth BFF, health probes). */
export function backendUpstreamHeaders(
  extra?: Record<string, string | undefined>,
): Record<string, string> {
  const headers: Record<string, string> = { ...vercelProtectionBypassHeaders() };
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined && value !== "") {
        headers[key] = value;
      }
    }
  }
  return headers;
}
