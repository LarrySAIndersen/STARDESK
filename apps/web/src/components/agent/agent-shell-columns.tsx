"use client";

import { type ReactNode, useEffect } from "react";
import { Group, Panel, useDefaultLayout, usePanelRef } from "react-resizable-panels";

import { ShellResizeSeparator } from "@/components/ui/shell-resize-separator";
import {
  SHELL_NAV,
  SHELL_NAV_COLLAPSED_WIDTH,
  SHELL_PANEL_MAIN,
  SHELL_PANEL_NAV,
  SHELL_WIDTHS_STORAGE_KEY,
} from "@/lib/shell-layout";
import { cn } from "@/lib/utils";

type AgentShellColumnsProps = {
  sidebar: ReactNode;
  children: ReactNode;
  collapsed: boolean;
};

const FALLBACK_LAYOUT = {
  [SHELL_PANEL_NAV]: SHELL_NAV.default,
};

export function AgentShellColumns({ sidebar, children, collapsed }: AgentShellColumnsProps) {
  const navPanelRef = usePanelRef();
  const panelIds = [SHELL_PANEL_NAV, SHELL_PANEL_MAIN];

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: SHELL_WIDTHS_STORAGE_KEY,
    panelIds,
    storage: localStorage,
  });

  const initialLayout = defaultLayout ?? FALLBACK_LAYOUT;

  useEffect(() => {
    const panel = navPanelRef.current;
    if (!panel) return;
    if (collapsed) {
      panel.collapse();
    } else {
      panel.expand();
    }
  }, [collapsed, navPanelRef]);

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
        panelRef={navPanelRef}
        defaultSize={SHELL_NAV.default}
        minSize={collapsed ? SHELL_NAV_COLLAPSED_WIDTH : SHELL_NAV.min}
        maxSize={collapsed ? SHELL_NAV_COLLAPSED_WIDTH : SHELL_NAV.max}
        collapsedSize={SHELL_NAV_COLLAPSED_WIDTH}
        collapsible
        disabled={collapsed}
        groupResizeBehavior="preserve-pixel-size"
        className="min-h-0 min-w-0"
      >
        {sidebar}
      </Panel>
      {collapsed ? null : <ShellResizeSeparator />}
      <Panel id={SHELL_PANEL_MAIN} minSize={240} className={cn("flex min-h-0 min-w-0 flex-col")}>
        {children}
      </Panel>
    </Group>
  );
}
