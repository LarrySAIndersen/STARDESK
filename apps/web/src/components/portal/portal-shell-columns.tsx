"use client";

import { type ReactNode } from "react";
import { Group, Panel, useDefaultLayout } from "react-resizable-panels";

import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { ShellResizeSeparator } from "@/components/ui/shell-resize-separator";
import {
  PORTAL_NAV,
  PORTAL_PANEL_MAIN,
  PORTAL_PANEL_NAV,
  PORTAL_SHELL_WIDTHS_STORAGE_KEY,
} from "@/lib/shell-layout";

type PortalShellColumnsProps = {
  children: ReactNode;
};

export function PortalShellColumns({ children }: PortalShellColumnsProps) {
  const panelIds = [PORTAL_PANEL_NAV, PORTAL_PANEL_MAIN];

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: PORTAL_SHELL_WIDTHS_STORAGE_KEY,
    panelIds,
    storage: localStorage,
  });

  const initialLayout = defaultLayout ?? {
    [PORTAL_PANEL_NAV]: PORTAL_NAV.default,
  };

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
        defaultSize={PORTAL_NAV.default}
        minSize={PORTAL_NAV.min}
        maxSize={PORTAL_NAV.max}
        groupResizeBehavior="preserve-pixel-size"
        className="min-h-0 min-w-0"
      >
        <PortalSidebar />
      </Panel>
      <ShellResizeSeparator />
      <Panel id={PORTAL_PANEL_MAIN} minSize={280} className="min-h-0 min-w-0">
        <div className="wire-scroll-content h-full min-h-0 overflow-y-auto">{children}</div>
      </Panel>
    </Group>
  );
}
