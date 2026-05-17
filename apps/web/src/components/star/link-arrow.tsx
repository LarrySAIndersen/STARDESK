import Link from "next/link";

import { cn } from "@/lib/utils";

export function StarLinkArrow({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2 text-sm font-semibold text-star-blue hover:text-star-navy",
        className,
      )}
    >
      <span
        aria-hidden
        className="border-star-blue text-star-blue group-hover:border-star-navy group-hover:text-star-navy flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-sm transition-colors"
      >
        ›
      </span>
      {children}
    </Link>
  );
}
