import { getEnvironmentBannerContent } from "@/lib/stardesk-env";

/** Fixed top bar — always visible so prod vs staging/preprod is unmistakable. */
export function EnvironmentBanner() {
  const { label, detail, className } = getEnvironmentBannerContent();

  return (
    <div
      role="status"
      aria-live="polite"
      className={`sticky top-0 z-[100] w-full border-b border-black/10 px-3 py-2 text-center text-xs font-medium shadow-sm sm:text-sm ${className}`}
    >
      <span className="font-bold tracking-wide">{label}</span>
      <span className="mx-2 opacity-80" aria-hidden>
        ·
      </span>
      <span>{detail}</span>
    </div>
  );
}
