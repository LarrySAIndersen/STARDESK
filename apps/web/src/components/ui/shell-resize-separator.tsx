"use client";

import { Separator } from "react-resizable-panels";

import { cn } from "@/lib/utils";

type ShellResizeSeparatorProps = {
  orientation?: "horizontal" | "vertical";
  label?: string;
};

/** 4px drag hit area with a subtle divider line between shell columns. */
export function ShellResizeSeparator({
  orientation = "horizontal",
  label = "Træk for at ændre bredde",
}: ShellResizeSeparatorProps) {
  const horizontal = orientation === "horizontal";

  return (
    <Separator
      className={cn(
        "group relative z-10 shrink-0",
        horizontal
          ? "w-1 cursor-col-resize"
          : "h-1 cursor-row-resize",
      )}
      aria-label={label}
    >
      <span
        className={cn(
          "pointer-events-none absolute rounded-full bg-[var(--gray-border)] transition-colors group-hover:bg-primary/35 group-data-[separator-active]:bg-primary/50",
          horizontal
            ? "top-0 bottom-0 left-1/2 w-px -translate-x-1/2"
            : "top-1/2 right-0 left-0 h-px -translate-y-1/2",
        )}
        aria-hidden
      />
    </Separator>
  );
}
