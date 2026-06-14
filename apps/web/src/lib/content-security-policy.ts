export type ContentSecurityPolicyOptions = Readonly<{
  /** Production / Vercel production deploy — enables upgrade-insecure-requests. */
  isProductionDeploy?: boolean;
  /** Local `next dev` — allows eval for React Fast Refresh. */
  isDevServer?: boolean;
}>;

const PRODUCTION_API_ORIGINS = [
  "https://api-gamma-amber.vercel.app",
  "https://api-git-staging-kjaerby-1628s-projects.vercel.app",
] as const;

const EMBEDDED_FRAME_ORIGINS = ["https://releaserun.com"] as const;

function joinSources(sources: readonly string[]): string {
  return sources.join(" ");
}

/**
 * Build a Content-Security-Policy directive string for the Next.js web app.
 * Kept in a testable module so security scanners (e.g. Aikido) can be verified in CI.
 */
export function buildContentSecurityPolicy(
  options: ContentSecurityPolicyOptions = {},
): string {
  const { isProductionDeploy = false, isDevServer = false } = options;

  const scriptSrc = ["'self'", "'unsafe-inline'"];
  if (isDevServer) {
    scriptSrc.push("'unsafe-eval'");
  }

  const connectSrc = [
    "'self'",
    ...PRODUCTION_API_ORIGINS,
    "https://*.vercel.app",
    "wss://*.vercel.app",
  ];
  if (isDevServer) {
    connectSrc.push("http://localhost:8000", "ws://localhost:3000");
  }

  const directives: Record<string, string> = {
    "default-src": "'self'",
    "base-uri": "'self'",
    "connect-src": joinSources(connectSrc),
    "font-src": joinSources(["'self'", "data:"]),
    "form-action": "'self'",
    "frame-ancestors": "'none'",
    "frame-src": joinSources(["'self'", ...EMBEDDED_FRAME_ORIGINS]),
    "img-src": joinSources(["'self'", "data:", "blob:", "https:"]),
    "manifest-src": "'self'",
    "media-src": joinSources(["'self'", "blob:"]),
    "object-src": "'none'",
    "script-src": joinSources(scriptSrc),
    "style-src": joinSources(["'self'", "'unsafe-inline'"]),
    "worker-src": joinSources(["'self'", "blob:"]),
  };

  if (isProductionDeploy) {
    directives["upgrade-insecure-requests"] = "";
  }

  return Object.entries(directives)
    .map(([name, value]) => (value ? `${name} ${value}` : name))
    .join("; ");
}
