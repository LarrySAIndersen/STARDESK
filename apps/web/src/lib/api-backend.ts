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

function stardeskEnvironmentTier(): string | undefined {
  return (
    process.env.STARDESK_ENV ??
    process.env.NEXT_PUBLIC_STARDESK_ENV ??
    process.env.APP_ENV
  )
    ?.trim()
    .toLowerCase();
}

function isNonProductionStardeskEnvironment(): boolean {
  const tier = stardeskEnvironmentTier();
  return tier === "test" || tier === "development" || tier === "staging" || tier === "prod-clone";
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

function isVercelPreviewDeployment(): boolean {
  return vercelDeploymentTier() === "preview";
}

/** Server-side upstream API base URL (never exposed to browser fetch for auth). */
export function getApiBackendBase(): string {
  const stagingOverride = process.env.STARDESK_API_URL?.trim();

  // Vercel Preview must talk to the staging API (Neon test). Legacy Preview env often
  // still sets NEXT_PUBLIC_API_URL to production — new routes (e.g. impersonate) 404 there.
  if (
    isVercelHosted() &&
    isVercelPreviewDeployment() &&
    !previewUsesProductionApi()
  ) {
    if (stagingOverride) {
      return stagingOverride.replace(/\/$/, "");
    }
    return VERCEL_STAGING_API_FALLBACK;
  }

  const configured = (stagingOverride ?? process.env.NEXT_PUBLIC_API_URL)?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (
    isVercelHosted() &&
    (isNonProductionStardeskEnvironment() || !isVercelProductionDeployment())
  ) {
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
