"use client";

import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type SidebarRailExpandProps = Readonly<{
  onExpand: () => void;
  className?: string;
}>;

/** Always-visible expand control on the collapsed nav rail edge. */
export function SidebarRailExpand({ onExpand, className }: SidebarRailExpandProps) {
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label="Vis menu"
      aria-expanded={false}
      className={cn(
        "border-border text-foreground hover:bg-accent absolute top-[4.5rem] right-0 z-40 flex size-8 -translate-y-0 translate-x-1/2 items-center justify-center rounded-full border-2 bg-card shadow-md transition-colors",
        className,
      )}
    >
      <ChevronRight className="size-4" aria-hidden />
    </button>
  );
}
