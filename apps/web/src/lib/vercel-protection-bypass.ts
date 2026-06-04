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
