/** Cloud target label — must match API STARDESK_ENV / deploy/vercel/env-manifest.json targets. */

export type StardeskEnv = "development" | "test" | "production" | "prod-clone";

const VALID: StardeskEnv[] = ["development", "test", "production", "prod-clone"];

function vercelDeploymentTier(): string | undefined {
  return process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV;
}

export function getStardeskEnv(): StardeskEnv {
  const raw = (process.env.NEXT_PUBLIC_STARDESK_ENV ?? "").trim().toLowerCase();
  if (VALID.includes(raw as StardeskEnv)) {
    return raw as StardeskEnv;
  }

  const vercelEnv = vercelDeploymentTier();
  if (vercelEnv === "preview") {
    return "test";
  }
  if (vercelEnv === "production") {
    return "production";
  }

  if (process.env.NODE_ENV === "development") {
    return "development";
  }
  return "production";
}

/** Always show — prod and preprod must be visually distinct at the top. */
export function shouldShowEnvironmentBanner(): boolean {
  return true;
}

export function getEnvironmentBannerContent(): {
  label: string;
  detail: string;
  className: string;
} {
  const env = getStardeskEnv();
  switch (env) {
    case "production":
      return {
        label: "PRODUKTION",
        detail: "Live miljø — rigtige brugere og data (star-itsm.sbs)",
        className: "bg-[var(--star-navy-dark)] text-white",
      };
    case "test":
      return {
        label: "STAGING · Preview",
        detail: "Preprod — test og review. Ikke live produktion.",
        className: "bg-amber-600 text-white",
      };
    case "prod-clone":
      return {
        label: "PROD-KLON (UAT)",
        detail: "Prod-lignende konfiguration — isoleret database",
        className: "bg-amber-800 text-white",
      };
    case "development":
    default:
      return {
        label: "LOKAL UDVIKLING",
        detail: "Ikke produktion — localhost",
        className: "bg-amber-500 text-amber-950",
      };
  }
}

export function getEnvironmentShortLabel(): string {
  const env = getStardeskEnv();
  switch (env) {
    case "production":
      return "prod";
    case "test":
      return "staging";
    case "prod-clone":
      return "uat";
    default:
      return "dev";
  }
}
