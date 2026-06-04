"use client";

import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type SidebarCollapseToggleProps = Readonly<{
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
  style?: CSSProperties;
}>;

export function SidebarCollapseToggle({
  collapsed,
  onToggle,
  className,
  style,
}: SidebarCollapseToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? "Vis menu" : "Skjul menu"}
      aria-expanded={!collapsed}
      style={style}
      className={cn(
        "text-[var(--gray-mid)] hover:bg-star-blue-light hover:text-star-navy flex size-8 shrink-0 items-center justify-center rounded-sm transition-colors",
        className,
      )}
    >
      {collapsed ? (
        <ChevronRight className="size-4" aria-hidden />
      ) : (
        <ChevronLeft className="size-4" aria-hidden />
      )}
    </button>
  );
}
