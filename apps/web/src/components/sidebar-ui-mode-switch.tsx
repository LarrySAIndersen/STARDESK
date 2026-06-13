"use client";

import type { LucideIcon } from "lucide-react";

import { ClassicUiSwitcher } from "@/components/classic/classic-ui-switcher";
import type { UiMode } from "@/lib/classic-ui-mode";
import { cn } from "@/lib/utils";

/** Sidebar nav-styled control to switch between modern and classic ITSM UI. */
export function SidebarUiModeSwitch({
  targetMode,
  label,
  icon: Icon,
  active,
  collapsed,
  onNavigate,
}: {
  targetMode: UiMode;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <ClassicUiSwitcher
      targetMode={targetMode}
      onSwitched={onNavigate}
      className={cn(
        "wire-nav-item w-full border-0 bg-transparent text-left",
        active && "wire-nav-item--active",
        collapsed && "wire-nav-item--compact",
      )}
      ariaLabel={collapsed ? label : undefined}
      label={
        collapsed ? (
          <Icon className="size-[18px] shrink-0 opacity-70" aria-hidden />
        ) : (
          <>
            <Icon className="size-[15px] shrink-0 opacity-60" aria-hidden />
            <span className="wire-nav-item__label min-w-0 flex-1 truncate">{label}</span>
          </>
        )
      }
    />
  );
}
