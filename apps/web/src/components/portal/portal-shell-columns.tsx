"use client";

import { type ReactNode, useCallback, useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Group, Panel, useDefaultLayout, usePanelRef } from "react-resizable-panels";

import { MobileNavDrawer } from "@/components/mobile-nav-drawer";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { SidebarRailExpand } from "@/components/sidebar-rail-expand";
import { PortalTopBar } from "@/components/portal/portal-top-bar";
import { ShellResizeSeparator } from "@/components/ui/shell-resize-separator";
import { useIsLgUp } from "@/hooks/use-media-query";
import { getClientUser, isStaff } from "@/lib/auth";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import {
  PORTAL_NAV,
  PORTAL_PANEL_MAIN,
  PORTAL_PANEL_NAV,
  PORTAL_SHELL_WIDTHS_STORAGE_KEY,
  SHELL_NAV_COLLAPSED_WIDTH,
} from "@/lib/shell-layout";
import { getPanelLayoutStorage } from "@/lib/panel-layout-storage";
import type { User } from "@/types/user";

type PortalShellColumnsProps = Readonly<{
  children: ReactNode;
  user?: User | null;
}>;

export function PortalShellColumns({ children, user: serverUser }: PortalShellColumnsProps) {
  const { collapsed, toggle } = useSidebarCollapsed();
  const isLgUp = useIsLgUp();
  const sessionUser = serverUser ?? getClientUser();
  const isStaffUser = isStaff(sessionUser);
  const showPortalTopBar = !isStaffUser;
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  useLayoutEffect(() => {
    closeMobileNav();
  }, [pathname, closeMobileNav]);

  const navPanelRef = usePanelRef();
  const panelIds = [PORTAL_PANEL_NAV, PORTAL_PANEL_MAIN];

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: PORTAL_SHELL_WIDTHS_STORAGE_KEY,
    panelIds,
    storage: getPanelLayoutStorage(),
  });

  const initialLayout = defaultLayout ?? {
    [PORTAL_PANEL_NAV]: PORTAL_NAV.default,
  };

  useLayoutEffect(() => {
    if (!isLgUp) return;
    const panel = navPanelRef.current;
    if (!panel) return;
    if (collapsed) {
      panel.collapse();
    } else {
      panel.expand();
    }
  }, [collapsed, navPanelRef, isLgUp]);

  const mainContent = (
    <>
      {showPortalTopBar ? (
        <PortalTopBar user={sessionUser} onOpenNav={() => setMobileNavOpen(true)} />
      ) : null}
      <div className="wire-scroll-content h-full min-h-0 overflow-x-hidden overflow-y-auto">
        {children}
      </div>
    </>
  );

  const mobileDrawer = !isLgUp && !isStaffUser ? (
    <MobileNavDrawer open={mobileNavOpen} onClose={closeMobileNav} title="Selvbetjening">
      <PortalSidebar collapsed={false} onNavigate={closeMobileNav} />
    </MobileNavDrawer>
  ) : null;

  if (!isLgUp) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
        {mobileDrawer}
        {mainContent}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      {mobileDrawer}
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
          className="min-h-0 min-w-0"
        >
          <div className="relative h-full min-h-0">
            <PortalSidebar collapsed={collapsed} onToggle={toggle} />
            {collapsed ? <SidebarRailExpand onExpand={toggle} /> : null}
          </div>
        </Panel>
        {collapsed ? null : <ShellResizeSeparator />}
        <Panel id={PORTAL_PANEL_MAIN} minSize={280} className="min-h-0 min-w-0">
          {mainContent}
        </Panel>
      </Group>
    </div>
  );
}
