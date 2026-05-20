"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { AgentBrandHeader } from "@/components/agent/agent-brand-header";
import { AgentShellColumns } from "@/components/agent/agent-shell-columns";
import { AgentSidebar } from "@/components/agent/agent-sidebar";
import { AgentTopBar } from "@/components/agent/agent-top-bar";
import { MobileNavDrawer } from "@/components/mobile-nav-drawer";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import type { User } from "@/types/user";

export function AgentShell({
  children,
  topBarTitle,
  topBarActions,
  user,
  showUsersNav,
}: {
  children: React.ReactNode;
  topBarTitle?: string;
  topBarActions?: React.ReactNode;
  user?: User | null;
  /** Server-resolved admin nav — avoids JWT/cookie mismatch on client. */
  showUsersNav?: boolean;
}) {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebarCollapsed();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  const openMobileNav = useCallback(() => setMobileNavOpen(true), []);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById("main-content")?.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    closeMobileNav();
  }, [pathname, closeMobileNav]);

  return (
    <div className="agent-shell wire-app flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <AgentBrandHeader />
      <div className="wire-shell-accent" aria-hidden="true" />
      <MobileNavDrawer open={mobileNavOpen} onClose={closeMobileNav} title="Navigation">
        <AgentSidebar
          user={user}
          showUsersNav={showUsersNav}
          collapsed={false}
          onToggle={closeMobileNav}
          onNavigate={closeMobileNav}
        />
      </MobileNavDrawer>
      <AgentShellColumns
        collapsed={collapsed}
        onToggle={toggle}
        sidebar={
          <AgentSidebar
            user={user}
            showUsersNav={showUsersNav}
            collapsed={collapsed}
            onToggle={toggle}
          />
        }
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
          <AgentTopBar
            title={topBarTitle}
            actions={topBarActions}
            user={user}
            onOpenNav={openMobileNav}
          />
          <main
            id="main-content"
            tabIndex={-1}
            className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden outline-none"
          >
            {children}
          </main>
        </div>
      </AgentShellColumns>
    </div>
  );
}
