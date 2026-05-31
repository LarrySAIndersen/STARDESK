/** Cloud target label — must match API STARDESK_ENV / deploy/vercel/env-manifest.json targets. */

export type StardeskEnv = "development" | "test" | "production" | "prod-clone";

const VALID: StardeskEnv[] = ["development", "test", "production", "prod-clone"];

export function getStardeskEnv(): StardeskEnv {
  const raw = (process.env.NEXT_PUBLIC_STARDESK_ENV ?? "").trim().toLowerCase();
  if (VALID.includes(raw as StardeskEnv)) {
    return raw as StardeskEnv;
  }
  if (process.env.NODE_ENV === "development") {
    return "development";
  }
  return "production";
}

export function shouldShowEnvironmentBanner(): boolean {
  return getStardeskEnv() !== "production";
}

export function getEnvironmentBannerContent(): {
  label: string;
  detail: string;
  className: string;
} {
  const env = getStardeskEnv();
  switch (env) {
    case "test":
      return {
        label: "Testmiljø",
        detail: "Ikke produktion — data og URL'er er til QA",
        className: "bg-sky-600 text-white",
      };
    case "prod-clone":
      return {
        label: "Prod-klon (UAT)",
        detail: "Prod-lignende konfiguration — isoleret database",
        className: "bg-amber-700 text-white",
      };
    case "development":
    default:
      return {
        label: "Lokal udvikling",
        detail: "Ikke produktion — localhost",
        className: "bg-amber-500 text-amber-950",
      };
  }
}
