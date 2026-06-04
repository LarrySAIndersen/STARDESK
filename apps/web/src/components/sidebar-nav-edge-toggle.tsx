"use client";

import { SidebarCollapseToggle } from "@/components/sidebar-collapse-toggle";
import { SHELL_NAV_COLLAPSED_WIDTH } from "@/lib/shell-layout";

type SidebarNavEdgeToggleProps = Readonly<{
  onToggle: () => void;
}>;

/** Round expand control on the nav rail edge — same button as header toggle, classic pill on the boundary. */
export function SidebarNavEdgeToggle({ onToggle }: SidebarNavEdgeToggleProps) {
  return (
    <SidebarCollapseToggle
      collapsed
      onToggle={onToggle}
      className="pointer-events-auto absolute top-[calc(var(--wire-shell-header-h)/2)] z-[100] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-border bg-card shadow-md"
      style={{ left: SHELL_NAV_COLLAPSED_WIDTH }}
    />
  );
}
