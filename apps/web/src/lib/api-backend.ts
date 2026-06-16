import { hasApiProtectionBypass, isVercelDeploymentProtectionResponse } from "@/lib/vercel-protection-bypass";

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

function canReachStagingApiBackend(): boolean {
  return hasApiProtectionBypass();
}

/** Opt-in override: force BFF to production API even when staging is reachable. */
export function stagingApiExplicitlyDisabled(): boolean {
  return process.env.STARDESK_USE_STAGING_API === "false";
}

/** Opt-in: route BFF to Neon test staging API (requires working api Preview + DATABASE_URL). */
export function stagingApiExplicitlyEnabled(): boolean {
  return process.env.STARDESK_USE_STAGING_API === "true";
}

/** Hostnames that require x-vercel-protection-bypass from the API Vercel project. */
export function isProtectedStagingApiHost(base: string): boolean {
  const normalized = base.replace(/\/$/, "").toLowerCase();
  if (normalized === VERCEL_STAGING_API_FALLBACK) {
    return true;
  }
  return normalized.includes("api-git-staging") || normalized.includes("-git-staging-");
}

function shouldPreferStagingApiBackend(): boolean {
  if (stagingApiExplicitlyDisabled()) {
    return false;
  }
  return (
    isVercelHosted() &&
    !previewUsesProductionApi() &&
    canReachStagingApiBackend() &&
    (isVercelPreviewDeployment() || isNonProductionStardeskEnvironment())
  );
}

function stagingApiFallback(): string {
  return canReachStagingApiBackend()
    ? VERCEL_STAGING_API_FALLBACK
    : VERCEL_PROTOTYPE_API_FALLBACK;
}

/** Staging API base when preview/test can bypass deployment protection (impersonate lives here). */
export function getStagingApiBackendBase(): string | undefined {
  if (previewUsesProductionApi() || !canReachStagingApiBackend()) {
    return undefined;
  }
  const stagingOverride = process.env.STARDESK_API_URL?.trim();
  if (stagingOverride) {
    return stagingOverride.replace(/\/$/, "");
  }
  return VERCEL_STAGING_API_FALLBACK;
}

/** Prefer staging for auth routes that only exist on the staging API branch (impersonate). */
export function getStagingCapableAuthBackendBase(): string {
  return getStagingApiBackendBase() ?? getApiBackendBase();
}

/** Production or explicitly configured non-staging API — used when staging API is blocked. */
export function getApiBackendFallbackBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) {
    const base = configured.replace(/\/$/, "");
    if (!isProtectedStagingApiHost(base)) {
      return base;
    }
  }
  return VERCEL_PROTOTYPE_API_FALLBACK;
}

function resolveConfiguredApiBase(stagingOverride?: string): string | undefined {
  const configured = (stagingOverride ?? process.env.NEXT_PUBLIC_API_URL)?.trim();
  if (!configured) {
    return undefined;
  }
  const base = configured.replace(/\/$/, "");
  if (isProtectedStagingApiHost(base) && stagingApiExplicitlyDisabled()) {
    return getApiBackendFallbackBase();
  }
  if (!canReachStagingApiBackend() && isProtectedStagingApiHost(base)) {
    return getApiBackendFallbackBase();
  }
  return base;
}

/** Server-side upstream API base URL (never exposed to browser fetch for auth). */
export function getApiBackendBase(): string {
  const stagingOverride = process.env.STARDESK_API_URL?.trim();

  if (shouldPreferStagingApiBackend()) {
    if (stagingOverride) {
      return stagingOverride.replace(/\/$/, "");
    }
    return VERCEL_STAGING_API_FALLBACK;
  }

  const configured = resolveConfiguredApiBase(stagingOverride);
  if (configured) {
    return configured;
  }

  if (
    isVercelHosted() &&
    (isNonProductionStardeskEnvironment() || !isVercelProductionDeployment())
  ) {
    return previewUsesProductionApi()
      ? VERCEL_PROTOTYPE_API_FALLBACK
      : stagingApiFallback();
  }

  const base = isVercelHosted() ? VERCEL_PROTOTYPE_API_FALLBACK : "http://localhost:8000";
  return base.replace(/\/$/, "");
}

export function buildBackendUrl(path: string, base?: string): string {
  const resolvedBase = (base ?? getApiBackendBase()).replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${resolvedBase}${normalized}`;
}

/** Retry auth upstream against fallback API when protected staging upstream fails. */
export function shouldFallbackAuthUpstream(
  upstream: Response,
  primaryBase: string,
  fallbackBase: string,
): boolean {
  if (upstream.ok || fallbackBase === primaryBase) {
    return false;
  }
  if (isVercelDeploymentProtectionResponse(upstream)) {
    return true;
  }
  return isProtectedStagingApiHost(primaryBase);
}

/** Retry authenticated server fetches when JWT from prod API is rejected by staging host. */
export function shouldFallbackServerUpstream(
  upstream: Response,
  primaryBase: string,
  fallbackBase: string,
): boolean {
  if (upstream.ok || fallbackBase === primaryBase) {
    return false;
  }
  if (!isProtectedStagingApiHost(primaryBase)) {
    return false;
  }
  return upstream.status === 401 || upstream.status === 403 || upstream.status >= 500;
}

/** Retry staging-only auth routes when production API has not deployed them yet (404). */
export function shouldRetryAuthOnStagingForMissingRoute(
  upstream: Response,
  primaryBase: string,
  stagingBase: string | undefined,
): boolean {
  if (upstream.ok || !stagingBase || stagingBase === primaryBase) {
    return false;
  }
  return upstream.status === 404 && !isProtectedStagingApiHost(primaryBase);
}

export const IMPERSONATION_SESSION_MISMATCH_DETAIL =
  "Impersonering kræver login mod test-API. Log ud, log ind igen, og prøv derefter — eller bed administrator om at aktivere STARDESK_USE_STAGING_API på web Preview.";
