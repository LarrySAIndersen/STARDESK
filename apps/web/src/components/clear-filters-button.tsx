"use client";

import { X } from "lucide-react";

type ClearFiltersButtonProps = {
  onClick: () => void;
  visible?: boolean;
  /** @default "Nulstil filter" */
  label?: string;
  className?: string;
};

export function ClearFiltersButton({
  onClick,
  visible = true,
  label = "Nulstil filter",
  className = "",
}: ClearFiltersButtonProps) {
  if (!visible) {
    return null;
  }

  return (
    <button
      type="button"
      className={`wire-btn wire-btn-sm inline-flex shrink-0 items-center gap-1 ${className}`.trim()}
      onClick={onClick}
      aria-label={label}
    >
      <X className="size-3" aria-hidden />
      {label}
    </button>
  );
}
