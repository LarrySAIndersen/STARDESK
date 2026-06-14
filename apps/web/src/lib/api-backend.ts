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

function normalizeBase(url: string): string {
  return url.replace(/\/$/, "");
}

function configuredPublicApiBase(): string | undefined {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  return configured ? normalizeBase(configured) : undefined;
}

function pointsAtProductionApi(base: string | undefined): boolean {
  if (!base) {
    return true;
  }
  return base === VERCEL_PROTOTYPE_API_FALLBACK;
}

function stagingApiBase(): string {
  return previewUsesProductionApi()
    ? VERCEL_PROTOTYPE_API_FALLBACK
    : VERCEL_STAGING_API_FALLBACK;
}

/** Server-side upstream API base URL (SSR, auth BFF, health checks). */
export function getApiBackendBase(): string {
  const configured = (process.env.STARDESK_API_URL ?? process.env.NEXT_PUBLIC_API_URL)?.trim();
  if (configured) {
    return normalizeBase(configured);
  }

  if (
    isVercelHosted() &&
    (isNonProductionStardeskEnvironment() || !isVercelProductionDeployment())
  ) {
    return stagingApiBase();
  }

  const base = isVercelHosted() ? VERCEL_PROTOTYPE_API_FALLBACK : "http://localhost:8000";
  return normalizeBase(base);
}

/**
 * Browser BFF proxy upstream. Custom-domain staging (tstar-itsm.sbs) may keep
 * NEXT_PUBLIC_API_URL on production for SSR, but client mutations must reach
 * staging-only routes such as POST /review-notes/{id}/delete.
 */
export function getProxyBackendBase(): string {
  const serverConfigured = process.env.STARDESK_API_URL?.trim();
  if (serverConfigured) {
    return normalizeBase(serverConfigured);
  }

  const publicBase = configuredPublicApiBase();
  if (
    isVercelHosted() &&
    isNonProductionStardeskEnvironment() &&
    pointsAtProductionApi(publicBase) &&
    !previewUsesProductionApi()
  ) {
    return VERCEL_STAGING_API_FALLBACK;
  }

  if (publicBase) {
    return publicBase;
  }

  return getApiBackendBase();
}

export function buildBackendUrl(path: string): string {
  const base = getApiBackendBase();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

export function buildProxyBackendUrl(path: string): string {
  const base = getProxyBackendBase();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
