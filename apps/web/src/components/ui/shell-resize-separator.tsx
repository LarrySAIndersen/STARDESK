"use client";

import { Separator } from "react-resizable-panels";

import { cn } from "@/lib/utils";

type ShellResizeSeparatorProps = Readonly<{
  id?: string;
  orientation?: "horizontal" | "vertical";
  label?: string;
}>;

/** Wide drag hit area with a subtle divider line between shell columns. */
export function ShellResizeSeparator({
  id,
  orientation = "horizontal",
  label = "Træk for at ændre bredde",
}: ShellResizeSeparatorProps) {
  const horizontal = orientation === "horizontal";

  return (
    <Separator
      id={id}
      className={cn(
        "group relative z-20 shrink-0 bg-transparent",
        horizontal
          ? "w-2 min-w-2 cursor-col-resize"
          : "h-2 min-h-2 cursor-row-resize",
      )}
      aria-label={label}
    >
      <span
        className={cn(
          "pointer-events-none absolute rounded-full bg-[var(--gray-border)] transition-colors group-hover:bg-primary/40 group-data-[separator-active]:bg-primary/55",
          horizontal
            ? "top-0 bottom-0 left-1/2 w-0.5 -translate-x-1/2"
            : "top-1/2 right-0 left-0 h-0.5 -translate-y-1/2",
        )}
        aria-hidden
      />
    </Separator>
  );
}
