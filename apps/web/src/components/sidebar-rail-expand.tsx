"use client";

import { ChevronRight } from "lucide-react";

import { SHELL_NAV_COLLAPSED_WIDTH } from "@/lib/shell-layout";
import { cn } from "@/lib/utils";

type SidebarRailExpandProps = Readonly<{
  onExpand: () => void;
  className?: string;
}>;

/** Expand control on the collapsed nav rail — rendered outside the panel to avoid overflow clipping. */
export function SidebarRailExpand({ onExpand, className }: SidebarRailExpandProps) {
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label="Vis menu"
      aria-expanded={false}
      style={{ left: SHELL_NAV_COLLAPSED_WIDTH / 2 }}
      className={cn(
        "border-border text-foreground hover:bg-accent pointer-events-auto absolute top-[4.5rem] z-[100] flex size-8 -translate-x-1/2 items-center justify-center rounded-full border-2 bg-card shadow-md transition-colors",
        className,
      )}
    >
      <ChevronRight className="size-4" aria-hidden />
    </button>
  );
}
