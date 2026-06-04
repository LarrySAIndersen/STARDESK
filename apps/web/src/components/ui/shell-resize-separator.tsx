"use client";

import { Separator } from "react-resizable-panels";

import { cn } from "@/lib/utils";

type ShellResizeSeparatorProps = Readonly<{
  id?: string;
  orientation?: "horizontal" | "vertical";
  label?: string;
  disabled?: boolean;
  /** Zero-width invisible separator (keeps panel group structure stable). */
  hidden?: boolean;
}>;

/** Wide drag hit area with a subtle divider line between shell columns. */
export function ShellResizeSeparator({
  id,
  orientation = "horizontal",
  label = "Træk for at ændre bredde",
  disabled = false,
  hidden = false,
}: ShellResizeSeparatorProps) {
  const horizontal = orientation === "horizontal";

  return (
    <Separator
      id={id}
      disabled={disabled}
      className={cn(
        "group relative z-20 shrink-0 bg-transparent",
        hidden
          ? horizontal
            ? "pointer-events-none w-0 min-w-0 overflow-hidden opacity-0"
            : "pointer-events-none h-0 min-h-0 overflow-hidden opacity-0"
          : horizontal
            ? "w-2 min-w-2 cursor-col-resize"
            : "h-2 min-h-2 cursor-row-resize",
      )}
      aria-label={label}
      aria-hidden={hidden || undefined}
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
