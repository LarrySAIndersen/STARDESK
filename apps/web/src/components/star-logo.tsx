import Image from "next/image";

import { cn } from "@/lib/utils";

const MARK_SIZE = 40;

const ORG_NAME = "Styrelsen for Arbejdsmarked og Rekruttering";

export function StarLogo({
  className,
  priority = false,
  inverted = false,
  showOrgSubtitle = false,
}: {
  className?: string;
  priority?: boolean;
  /** Light mark for navy header backgrounds. */
  inverted?: boolean;
  /** Org name beside mark (brand bar, large screens). */
  showOrgSubtitle?: boolean;
}) {
  const src = inverted ? "/images/star-logo-on-dark.svg" : "/images/star-logo.svg";

  const mark = (
    <Image
      src={src}
      unoptimized
      alt={showOrgSubtitle ? "" : "STAR — Styrelsen for Arbejdsmarked og Rekruttering"}
      width={MARK_SIZE}
      height={MARK_SIZE}
      className={cn("size-9 shrink-0 sm:size-10", className)}
      priority={priority}
      aria-hidden={showOrgSubtitle ? true : undefined}
    />
  );

  if (!showOrgSubtitle) {
    return mark;
  }

  return (
    <span className="flex min-w-0 items-center gap-3">
      {mark}
      <span className="hidden min-w-0 max-w-[11rem] flex-col leading-tight lg:flex">
        <span className="text-[10px] font-semibold tracking-wide text-white/90 uppercase">
          STAR
        </span>
        <span className="text-[9px] font-medium text-white/65">{ORG_NAME}</span>
      </span>
    </span>
  );
}
