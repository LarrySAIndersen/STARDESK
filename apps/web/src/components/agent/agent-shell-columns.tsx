"use client";

import { type ReactNode, useLayoutEffect } from "react";
import { Group, Panel, useDefaultLayout, usePanelRef } from "react-resizable-panels";

import { SidebarRailExpand } from "@/components/sidebar-rail-expand";
import { ShellResizeSeparator } from "@/components/ui/shell-resize-separator";
import { useIsLgUp } from "@/hooks/use-media-query";
import {
  SHELL_NAV,
  SHELL_NAV_COLLAPSED_WIDTH,
  SHELL_PANEL_MAIN,
  SHELL_PANEL_NAV,
  SHELL_WIDTHS_STORAGE_KEY,
} from "@/lib/shell-layout";
import { getPanelLayoutStorage } from "@/lib/panel-layout-storage";
import { syncShellNavPanel } from "@/lib/sync-shell-nav-panel";
import { cn } from "@/lib/utils";

type AgentShellColumnsProps = Readonly<{
  sidebar: ReactNode;
  children: ReactNode;
  collapsed: boolean;
  onToggle: () => void;
}>;

const FALLBACK_LAYOUT = {
  [SHELL_PANEL_NAV]: SHELL_NAV.default,
};

export function AgentShellColumns({
  sidebar,
  children,
  collapsed,
  onToggle,
}: AgentShellColumnsProps) {
  const isLgUp = useIsLgUp();
  const navPanelRef = usePanelRef();
  const panelIds = [SHELL_PANEL_NAV, SHELL_PANEL_MAIN];

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: SHELL_WIDTHS_STORAGE_KEY,
    panelIds,
    storage: getPanelLayoutStorage(),
  });

  const initialLayout = defaultLayout ?? FALLBACK_LAYOUT;

  useLayoutEffect(() => {
    if (!isLgUp) return;
    syncShellNavPanel(navPanelRef.current, collapsed, SHELL_NAV.default);
  }, [collapsed, navPanelRef, isLgUp]);

  if (!isLgUp) {
    return (
      <div className="agent-shell-main flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
        {children}
      </div>
    );
  }

  return (
    <Group
      id={SHELL_WIDTHS_STORAGE_KEY}
      orientation="horizontal"
      className="agent-shell min-h-0 min-w-0 flex-1"
      defaultLayout={initialLayout}
      onLayoutChanged={onLayoutChanged}
      resizeTargetMinimumSize={{ fine: 4, coarse: 28 }}
    >
      <Panel
        id={SHELL_PANEL_NAV}
        panelRef={navPanelRef}
        defaultSize={SHELL_NAV.default}
        minSize={SHELL_NAV.min}
        maxSize={SHELL_NAV.max}
        collapsedSize={SHELL_NAV_COLLAPSED_WIDTH}
        collapsible
        groupResizeBehavior="preserve-pixel-size"
        className="min-h-0 min-w-0"
      >
        <div className="relative h-full min-h-0">
          {sidebar}
          {collapsed ? <SidebarRailExpand onExpand={onToggle} /> : null}
        </div>
      </Panel>
      {collapsed ? null : <ShellResizeSeparator />}
      <Panel id={SHELL_PANEL_MAIN} minSize={240} className={cn("flex min-h-0 min-w-0 flex-col")}>
        {children}
      </Panel>
    </Group>
  );
}
