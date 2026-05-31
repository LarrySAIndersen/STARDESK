/** Production API — fallback when NEXT_PUBLIC_API_URL is missing on Vercel builds. */
const VERCEL_PROTOTYPE_API_FALLBACK = "https://api-gamma-amber.vercel.app";

/** Server-side upstream API base URL (never exposed to browser fetch for auth). */
export function getApiBackendBase(): string {
  const configured = process.env.STARDESK_API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  const base =
    configured ??
    (process.env.VERCEL ? VERCEL_PROTOTYPE_API_FALLBACK : "http://localhost:8000");
  return base.replace(/\/$/, "");
}

export function buildBackendUrl(path: string): string {
  const base = getApiBackendBase();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
