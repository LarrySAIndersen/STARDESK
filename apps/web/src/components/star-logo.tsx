import Image from "next/image";

import { cn } from "@/lib/utils";

const DEFAULT_MARK_SIZE = 40;

const ORG_SUBTITLE = "STARdesk";

export function StarLogo({
  className,
  priority = false,
  inverted = false,
  showOrgSubtitle = false,
  /** Intrinsic mark size in CSS pixels (default 40). */
  markSize = DEFAULT_MARK_SIZE,
}: {
  className?: string;
  priority?: boolean;
  /** Light mark for navy header backgrounds. */
  inverted?: boolean;
  /** Org name beside mark (brand bar, large screens). */
  showOrgSubtitle?: boolean;
  markSize?: number;
}) {
  const src = inverted ? "/images/star-logo-on-dark.svg" : "/images/star-logo.svg";

  const mark = (
    <Image
      src={src}
      unoptimized
      alt={showOrgSubtitle ? "" : "STARdesk"}
      width={markSize}
      height={markSize}
      className={cn(
        "shrink-0",
        markSize === DEFAULT_MARK_SIZE ? "size-9 sm:size-10" : undefined,
        className,
      )}
      style={markSize === DEFAULT_MARK_SIZE ? undefined : { width: markSize, height: markSize }}
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
        <span className="text-[9px] font-medium text-white/65">{ORG_SUBTITLE}</span>
      </span>
    </span>
  );
}
