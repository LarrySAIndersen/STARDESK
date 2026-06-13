"use client";

import { type ReactNode } from "react";
import { Group, Panel, useDefaultLayout, usePanelRef } from "react-resizable-panels";

import { SidebarNavEdgeToggle } from "@/components/sidebar-nav-edge-toggle";
import { ShellNavPanelProvider } from "@/components/shell-nav-panel-context";
import { ShellResizeSeparator } from "@/components/ui/shell-resize-separator";
import { useIsLgUp } from "@/hooks/use-media-query";
import { useShellNavToggle, useSyncShellNavPanel } from "@/hooks/use-sync-shell-nav-panel";
import {
  SHELL_NAV,
  SHELL_NAV_COLLAPSED_WIDTH,
  SHELL_PANEL_MAIN,
  SHELL_PANEL_NAV,
  SHELL_WIDTHS_STORAGE_KEY,
} from "@/lib/shell-layout";
import { getPanelLayoutStorage } from "@/lib/panel-layout-storage";
import { cn } from "@/lib/utils";

type AgentShellColumnsProps = Readonly<{
  sidebar: ReactNode;
  children: ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  /** Home landing: no vertical rule between nav and main content. */
  hideNavSeparator?: boolean;
}>;

const FALLBACK_LAYOUT_NAV_ONLY = {
  [SHELL_PANEL_NAV]: SHELL_NAV.default,
};

export function AgentShellColumns({
  sidebar,
  children,
  collapsed,
  onToggle,
  hideNavSeparator = false,
}: AgentShellColumnsProps) {
  const isLgUp = useIsLgUp();
  const navPanelRef = usePanelRef();
  const panelIds = [SHELL_PANEL_NAV, SHELL_PANEL_MAIN];

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: SHELL_WIDTHS_STORAGE_KEY,
    panelIds,
    storage: getPanelLayoutStorage(),
  });

  const initialLayout = defaultLayout ?? FALLBACK_LAYOUT_NAV_ONLY;

  useSyncShellNavPanel(navPanelRef, collapsed, SHELL_NAV.default, isLgUp);
  const toggleNav = useShellNavToggle(navPanelRef, collapsed, onToggle, SHELL_NAV.default);

  if (!isLgUp) {
    return (
      <div className="agent-shell-main flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
        {children}
      </div>
    );
  }

  return (
    <ShellNavPanelProvider toggleNav={toggleNav}>
      <div className="relative min-h-0 min-w-0 flex-1">
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
            <div className="relative h-full min-h-0">{sidebar}</div>
          </Panel>
          <ShellResizeSeparator
            disabled={collapsed}
            hidden={collapsed || hideNavSeparator}
          />
          <Panel id={SHELL_PANEL_MAIN} minSize={240} className={cn("flex min-h-0 min-w-0 flex-col")}>
            {children}
          </Panel>
        </Group>
        {collapsed ? <SidebarNavEdgeToggle onToggle={toggleNav} /> : null}
      </div>
    </ShellNavPanelProvider>
  );
}
