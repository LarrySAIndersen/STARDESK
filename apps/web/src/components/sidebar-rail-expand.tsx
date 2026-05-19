"use client";

import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type SidebarRailExpandProps = {
  onExpand: () => void;
  className?: string;
};

/** Always-visible expand control on the collapsed nav rail edge. */
export function SidebarRailExpand({ onExpand, className }: SidebarRailExpandProps) {
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label="Vis menu"
      aria-expanded={false}
      className={cn(
        "border-star-navy/15 text-star-navy hover:bg-star-blue-light absolute top-1/2 right-0 z-30 flex size-7 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-sm border bg-white shadow-sm transition-colors",
        className,
      )}
    >
      <ChevronRight className="size-4" aria-hidden />
    </button>
  );
}
