import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ClickableMetricProps = Readonly<{
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
  /** When true, underline/hover only on the number wrapper (for nested layouts). */
  inline?: boolean;
}>;

const interactiveClass =
  "cursor-pointer rounded-sm transition-shadow hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-star-blue";

/**
 * Wraps a displayed metric (count, %, gauge label) with drill-down navigation or in-page filter.
 */
export function ClickableMetric({
  children,
  href,
  onClick,
  className,
  ariaLabel,
  inline = false,
}: ClickableMetricProps) {
  if (!href && !onClick) {
    return <span className={className}>{children}</span>;
  }

  const merged = cn(interactiveClass, inline && "hover:underline", className);

  if (href) {
    return (
      <Link href={href} className={merged} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={cn(merged, "border-0 bg-transparent p-0")} aria-label={ariaLabel}>
      {children}
    </button>
  );
}
