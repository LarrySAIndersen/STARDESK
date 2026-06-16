/**
 * Server-side calls from web → protected Preview API deployments.
 * See docs/staging-vercel-preview-env.md and Vercel "Protection Bypass for Automation".
 *
 * Important: VERCEL_AUTOMATION_BYPASS_SECRET on the *web* project only bypasses web
 * deployment protection — it does not unlock the separate *api* Vercel project.
 * Copy the API project's bypass token into VERCEL_PROTECTION_BYPASS (web Preview).
 */
export function apiUpstreamProtectionBypassHeaders(): Record<string, string> {
  const secret =
    process.env.STARDESK_API_PROTECTION_BYPASS?.trim() ||
    process.env.VERCEL_PROTECTION_BYPASS?.trim();
  if (!secret) {
    return {};
  }
  return { "x-vercel-protection-bypass": secret };
}

/** @deprecated Prefer apiUpstreamProtectionBypassHeaders for web → API calls. */
export function vercelProtectionBypassHeaders(): Record<string, string> {
  return apiUpstreamProtectionBypassHeaders();
}

/** Merge API protection bypass with optional upstream headers (auth BFF, health probes). */
export function backendUpstreamHeaders(
  extra?: Record<string, string | undefined>,
): Record<string, string> {
  const headers: Record<string, string> = { ...apiUpstreamProtectionBypassHeaders() };
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined && value !== "") {
        headers[key] = value;
      }
    }
  }
  return headers;
}

/** True when Vercel Deployment Protection returned its HTML login page. */
export function isVercelDeploymentProtectionResponse(response: Response): boolean {
  if (response.status !== 401) {
    return false;
  }
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("text/html");
}

export const UPSTREAM_PROTECTION_BLOCKED_DETAIL =
  "Staging API er blokeret (Vercel Deployment Protection). Sæt VERCEL_PROTECTION_BYPASS på web-projektet til API'ens bypass-token (se docs/staging-vercel-preview-env.md).";
