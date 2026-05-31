/** Production API — fallback when NEXT_PUBLIC_API_URL is missing on Vercel builds. */
export const VERCEL_PROTOTYPE_API_FALLBACK = "https://api-gamma-amber.vercel.app";

/**
 * Preview web must use the same API/DB as production so demo logins match prod.
 * Set STARDESK_PREVIEW_USE_PROD_API=false once Neon test is seeded for Preview API.
 */
function previewUsesProductionApi(): boolean {
  return process.env.STARDESK_PREVIEW_USE_PROD_API !== "false";
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
  // Preview / branch deploys on Vercel → same prod API + Neon data as production web.
  if (isVercelHosted() && !isVercelProductionDeployment() && previewUsesProductionApi()) {
    return VERCEL_PROTOTYPE_API_FALLBACK;
  }

  const configured = process.env.STARDESK_API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  const base =
    configured ??
    (isVercelHosted() ? VERCEL_PROTOTYPE_API_FALLBACK : "http://localhost:8000");
  return base.replace(/\/$/, "");
}

export function buildBackendUrl(path: string): string {
  const base = getApiBackendBase();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
