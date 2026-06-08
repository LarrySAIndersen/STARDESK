/** Production API — fallback when NEXT_PUBLIC_API_URL is missing on Vercel builds. */
export const VERCEL_PROTOTYPE_API_FALLBACK = "https://api-gamma-amber.vercel.app";

/** Staging Preview API branch alias (see docs/staging-vercel-preview-env.md). */
export const VERCEL_STAGING_API_FALLBACK =
  "https://api-git-staging-kjaerby-1628s-projects.vercel.app";

/**
 * Preview web defaulted to production API until Neon test was seeded.
 * Staging Preview now uses the test API unless STARDESK_PREVIEW_USE_PROD_API=true.
 */
function previewUsesProductionApi(): boolean {
  return process.env.STARDESK_PREVIEW_USE_PROD_API === "true";
}

function vercelDeploymentTier(): string | undefined {
  return process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV;
}

function isVercelProductionDeployment(): boolean {
  return vercelDeploymentTier() === "production";
}

function isVercelHosted(): boolean {
  return (
    process.env.VERCEL === "1" ||
    Boolean(process.env.VERCEL_URL) ||
    Boolean(process.env.NEXT_PUBLIC_VERCEL_URL)
  );
}

/** Server-side upstream API base URL (never exposed to browser fetch for auth). */
export function getApiBackendBase(): string {
  const configured = (process.env.STARDESK_API_URL ?? process.env.NEXT_PUBLIC_API_URL)?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (isVercelHosted() && !isVercelProductionDeployment()) {
    return previewUsesProductionApi()
      ? VERCEL_PROTOTYPE_API_FALLBACK
      : VERCEL_STAGING_API_FALLBACK;
  }

  const base = isVercelHosted() ? VERCEL_PROTOTYPE_API_FALLBACK : "http://localhost:8000";
  return base.replace(/\/$/, "");
}

export function buildBackendUrl(path: string): string {
  const base = getApiBackendBase();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
