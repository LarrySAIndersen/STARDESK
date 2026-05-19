"use client";

import { type ReactNode, useLayoutEffect } from "react";
import { Group, Panel, useDefaultLayout, usePanelRef } from "react-resizable-panels";

import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { SidebarRailExpand } from "@/components/sidebar-rail-expand";
import { PortalTopBar } from "@/components/portal/portal-top-bar";
import { ShellResizeSeparator } from "@/components/ui/shell-resize-separator";
import { getClientUser, isStaff } from "@/lib/auth";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import {
  PORTAL_NAV,
  PORTAL_PANEL_MAIN,
  PORTAL_PANEL_NAV,
  PORTAL_SHELL_WIDTHS_STORAGE_KEY,
  SHELL_NAV_COLLAPSED_WIDTH,
} from "@/lib/shell-layout";

type PortalShellColumnsProps = {
  children: ReactNode;
};

export function PortalShellColumns({ children }: PortalShellColumnsProps) {
  const { collapsed, toggle } = useSidebarCollapsed();
  const showPortalTopBar = !isStaff(getClientUser());
  const navPanelRef = usePanelRef();
  const panelIds = [PORTAL_PANEL_NAV, PORTAL_PANEL_MAIN];

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: PORTAL_SHELL_WIDTHS_STORAGE_KEY,
    panelIds,
    storage: localStorage,
  });

  const initialLayout = defaultLayout ?? {
    [PORTAL_PANEL_NAV]: PORTAL_NAV.default,
  };

  useLayoutEffect(() => {
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
      id={PORTAL_SHELL_WIDTHS_STORAGE_KEY}
      orientation="horizontal"
      className="min-h-0 min-w-0 flex-1"
      defaultLayout={initialLayout}
      onLayoutChanged={onLayoutChanged}
      resizeTargetMinimumSize={{ fine: 4, coarse: 28 }}
    >
      <Panel
        id={PORTAL_PANEL_NAV}
        panelRef={navPanelRef}
        defaultSize={PORTAL_NAV.default}
        minSize={PORTAL_NAV.min}
        maxSize={PORTAL_NAV.max}
        collapsedSize={SHELL_NAV_COLLAPSED_WIDTH}
        collapsible
        groupResizeBehavior="preserve-pixel-size"
        className="min-h-0 min-w-0 overflow-hidden"
      >
        <div className="relative h-full min-h-0">
          <PortalSidebar collapsed={collapsed} onToggle={toggle} />
          {collapsed ? <SidebarRailExpand onExpand={toggle} /> : null}
        </div>
      </Panel>
      {collapsed ? null : <ShellResizeSeparator />}
      <Panel id={PORTAL_PANEL_MAIN} minSize={280} className="min-h-0 min-w-0">
        <div className="wire-scroll-content h-full min-h-0 overflow-y-auto">{children}</div>
      </Panel>
    </Group>
  );
}
