"use client";

import { type ReactNode } from "react";
import { Group, Panel, useDefaultLayout } from "react-resizable-panels";

import { ShellResizeSeparator } from "@/components/ui/shell-resize-separator";
import {
  SHELL_NAV,
  SHELL_PANEL_MAIN,
  SHELL_PANEL_NAV,
  SHELL_WIDTHS_STORAGE_KEY,
} from "@/lib/shell-layout";
import { cn } from "@/lib/utils";

type AgentShellColumnsProps = {
  sidebar: ReactNode;
  children: ReactNode;
};

const FALLBACK_LAYOUT = {
  [SHELL_PANEL_NAV]: SHELL_NAV.default,
};

export function AgentShellColumns({ sidebar, children }: AgentShellColumnsProps) {
  const panelIds = [SHELL_PANEL_NAV, SHELL_PANEL_MAIN];

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: SHELL_WIDTHS_STORAGE_KEY,
    panelIds,
    storage: localStorage,
  });

  const initialLayout = defaultLayout ?? FALLBACK_LAYOUT;

  return (
    <Group
      id={SHELL_WIDTHS_STORAGE_KEY}
      orientation="horizontal"
      className="min-h-0 min-w-0 flex-1"
      defaultLayout={initialLayout}
      onLayoutChanged={onLayoutChanged}
      resizeTargetMinimumSize={{ fine: 4, coarse: 28 }}
    >
      <Panel
        id={SHELL_PANEL_NAV}
        defaultSize={SHELL_NAV.default}
        minSize={SHELL_NAV.min}
        maxSize={SHELL_NAV.max}
        groupResizeBehavior="preserve-pixel-size"
        className="min-h-0 min-w-0"
      >
        {sidebar}
      </Panel>
      <ShellResizeSeparator />
      <Panel id={SHELL_PANEL_MAIN} minSize={240} className={cn("flex min-h-0 min-w-0 flex-col")}>
        {children}
      </Panel>
    </Group>
  );
}
