"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { AgentBrandHeader } from "@/components/agent/agent-brand-header";
import { AgentErrorBoundary } from "@/components/agent/agent-error-boundary";
import { AgentShellColumns } from "@/components/agent/agent-shell-columns";
import { AgentSidebar } from "@/components/agent/agent-sidebar";
import { AgentTopBar } from "@/components/agent/agent-top-bar";
import { ReviewNotesOverlay } from "@/components/review-notes/review-notes-overlay";
import { PageLayoutEditProvider } from "@/components/page-layout/page-layout-edit-provider";
import { PageLayoutEditMainChrome } from "@/components/page-layout/page-layout-edit-main-chrome";
import { canEditPageLayout } from "@/lib/page-layout/access";
import { PageLayoutEditToolbar } from "@/components/page-layout/page-layout-edit-toolbar";
import { MobileNavDrawer } from "@/components/mobile-nav-drawer";
import { ChatWorkspacePanel } from "@/components/team-chat/chat-workspace-panel";
import { TeamChatDock } from "@/components/team-chat/team-chat-dock";
import {
  ChatWorkspaceProvider,
  useChatWorkspace,
} from "@/components/team-chat/chat-workspace-provider";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { isStaff } from "@/lib/auth";
import type { User } from "@/types/user";

function AgentShellInner({
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
  showUsersNav?: boolean;
}) {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebarCollapsed();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { open: chatOpen, closeChat } = useChatWorkspace();
  const staff = isStaff(user ?? null);
  const isChatPage = pathname === "/chat";
  const showChatPanel = staff && chatOpen && !isChatPage;

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  const openMobileNav = useCallback(() => setMobileNavOpen(true), []);

  useEffect(() => {
    if (isChatPage) {
      closeChat();
    }
  }, [isChatPage, closeChat]);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById("main-content")?.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    closeMobileNav();
  }, [pathname, closeMobileNav]);

  return (
    <>
      <PageLayoutEditToolbar />
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
          <div className="team-chat-shell-header">
            <AgentTopBar
              title={topBarTitle}
              actions={topBarActions}
              user={user}
              onOpenNav={openMobileNav}
              showTeamChat={staff}
            />
            {staff ? (
              <TeamChatDock open={showChatPanel}>
                <ChatWorkspacePanel layout="dock" />
              </TeamChatDock>
            ) : null}
          </div>
          <PageLayoutEditMainChrome>
            <AgentErrorBoundary>{children}</AgentErrorBoundary>
            <ReviewNotesOverlay user={user ?? null} />
          </PageLayoutEditMainChrome>
        </div>
      </AgentShellColumns>
    </>
  );
}

export function AgentShell({
  children,
  topBarTitle,
  topBarActions,
  user,
  showUsersNav,
  showPageLayoutEdit,
}: {
  children: React.ReactNode;
  topBarTitle?: string;
  topBarActions?: React.ReactNode;
  user?: User | null;
  /** Server-resolved admin nav — avoids JWT/cookie mismatch on client. */
  showUsersNav?: boolean;
  /** Server-resolved layout design mode — same pattern as showUsersNav. */
  showPageLayoutEdit?: boolean;
}) {
  const staff = isStaff(user ?? null);

  return (
    <PageLayoutEditProvider
      user={user ?? null}
      canEditFromServer={showPageLayoutEdit ?? canEditPageLayout(user ?? null)}
    >
      <div className="agent-shell wire-app flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        {staff ? (
          <ChatWorkspaceProvider enabled={staff}>
            <AgentShellInner
              topBarTitle={topBarTitle}
              topBarActions={topBarActions}
              user={user}
              showUsersNav={showUsersNav}
            >
              {children}
            </AgentShellInner>
          </ChatWorkspaceProvider>
        ) : (
          <AgentShellInner
            topBarTitle={topBarTitle}
            topBarActions={topBarActions}
            user={user}
            showUsersNav={showUsersNav}
          >
            {children}
          </AgentShellInner>
        )}
      </div>
    </PageLayoutEditProvider>
  );
}
