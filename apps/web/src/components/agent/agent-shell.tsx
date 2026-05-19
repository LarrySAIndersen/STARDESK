"use client";

import { Suspense, useEffect } from "react";
import { usePathname } from "next/navigation";

import { AgentAssetPanel } from "@/components/agent/agent-asset-panel";
import { AgentBrandHeader } from "@/components/agent/agent-brand-header";
import { AgentSidebar } from "@/components/agent/agent-sidebar";
import { AgentTopBar } from "@/components/agent/agent-top-bar";
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

  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById("main-content")?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="wire-app flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <AgentBrandHeader />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AgentSidebar user={user} showUsersNav={showUsersNav} />
        <Suspense
          fallback={
            <aside className="wire-asset-panel" aria-hidden>
              <div className="wire-asset-panel-header">
                <span>Aktiver</span>
              </div>
            </aside>
          }
        >
          <AgentAssetPanel />
        </Suspense>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <AgentTopBar title={topBarTitle} actions={topBarActions} />
          <main
            id="main-content"
            tabIndex={-1}
            className="flex min-h-0 flex-1 flex-col overflow-hidden outline-none"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
