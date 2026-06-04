"use client";

import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type SidebarRailExpandProps = Readonly<{
  onExpand: () => void;
  className?: string;
}>;

/** Expand control centered inside the collapsed nav rail (avoids main-panel click steal). */
export function SidebarRailExpand({ onExpand, className }: SidebarRailExpandProps) {
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label="Vis menu"
      aria-expanded={false}
      className={cn(
        "border-border text-foreground hover:bg-accent pointer-events-auto absolute top-[4.5rem] left-1/2 z-50 flex size-8 -translate-x-1/2 items-center justify-center rounded-full border-2 bg-card shadow-md transition-colors",
        className,
      )}
    >
      <ChevronRight className="size-4" aria-hidden />
    </button>
  );
}
