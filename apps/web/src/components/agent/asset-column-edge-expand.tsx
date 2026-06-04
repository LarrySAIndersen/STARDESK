"use client";

import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type AssetColumnEdgeExpandProps = Readonly<{
  onExpand: () => void;
  label?: string;
  className?: string;
}>;

/** Round expand control on the right edge of a squeezed asset column. */
export function AssetColumnEdgeExpand({
  onExpand,
  label = "Udvid kolonne",
  className,
}: AssetColumnEdgeExpandProps) {
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label={label}
      aria-expanded={false}
      className={cn(
        "border-border text-foreground hover:bg-accent pointer-events-auto absolute top-1/2 right-0 z-[100] flex size-8 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-card shadow-md transition-colors",
        className,
      )}
    >
      <ChevronRight className="size-4" aria-hidden />
    </button>
  );
}
