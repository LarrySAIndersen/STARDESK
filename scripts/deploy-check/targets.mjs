/**
 * Default deployment targets for STARDESK on Vercel.
 * Override via env: STARDESK_STAGING_API_URL, STARDESK_STAGING_WEB_URL, etc.
 */

/** @typedef {'staging'|'production'} DeployTarget */

/** @type {Record<DeployTarget, { branch: string, apiUrl: string, webUrl: string, vercelProjects: string[], requireNonProd: boolean }>} */
export const TARGETS = {
  staging: {
    branch: "staging",
    apiUrl:
      process.env.STARDESK_STAGING_API_URL ??
      "https://api-git-staging-kjaerby-1628s-projects.vercel.app",
    webUrl:
      process.env.STARDESK_STAGING_WEB_URL ??
      "https://web-git-staging-kjaerby-1628s-projects.vercel.app",
    vercelProjects: ["api", "web"],
    requireNonProd: true,
  },
  production: {
    branch: "main",
    apiUrl: process.env.STARDESK_API_URL ?? "https://api-gamma-amber.vercel.app",
    webUrl: process.env.STARDESK_WEB_URL ?? "https://web-seven-neon-6bvmcoel7n.vercel.app",
    vercelProjects: ["api", "web"],
    requireNonProd: false,
  },
};

export function resolveTarget(name) {
  const key = /** @type {DeployTarget} */ (name ?? "staging");
  const target = TARGETS[key];
  if (!target) {
    throw new Error(`Unknown deploy target "${name}". Use staging or production.`);
  }
  return { key, ...target };
}
