import { getEnvironmentBannerContent, shouldShowEnvironmentBanner } from "@/lib/stardesk-env";

/** Visible on all non-production targets so dev/test is never confused with prod. */
export function EnvironmentBanner() {
  if (!shouldShowEnvironmentBanner()) {
    return null;
  }

  const { label, detail, className } = getEnvironmentBannerContent();

  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full px-3 py-1.5 text-center text-xs font-medium sm:text-sm ${className}`}
    >
      <span className="font-semibold">{label}</span>
      <span className="mx-2 opacity-80" aria-hidden>
        ·
      </span>
      <span>{detail}</span>
    </div>
  );
}
