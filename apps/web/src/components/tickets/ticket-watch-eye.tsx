"use client";

import { Eye } from "lucide-react";

import { cn } from "@/lib/utils";

export function TicketWatchEye({
  watching,
  onToggle,
  compact = false,
}: {
  watching: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded p-0.5 transition-colors",
        watching
          ? "text-[#1a7a44] hover:bg-[#e6f5ec] hover:text-[#146b38]"
          : "text-muted-foreground/50 hover:bg-muted hover:text-muted-foreground",
        compact ? "size-6" : "size-7",
      )}
      title={
        watching
          ? "Du overvåger — klik for at stoppe"
          : "Overvåg sag — vis i overblik og få besked ved opdateringer"
      }
      aria-label={watching ? "Stop overvågning af sag" : "Overvåg sag"}
      aria-pressed={watching}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
    >
      <Eye className={cn("size-3.5", watching && "fill-current/15")} aria-hidden />
    </button>
  );
}
