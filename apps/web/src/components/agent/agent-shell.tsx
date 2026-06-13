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
import { TeamChatFloatPanel } from "@/components/team-chat/team-chat-float-panel";
import {
  ChatWorkspaceProvider,
  useChatWorkspaceOptional,
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
  const chat = useChatWorkspaceOptional();
  const staff = isStaff(user ?? null);
  const chromeToolbar = staff;
  const isChatPage = pathname === "/chat";
  const isHomeLanding = pathname === "/";
  const showChatDock = staff && (chat?.open ?? false) && !isChatPage;

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
    <>
      <PageLayoutEditToolbar />
      <AgentBrandHeader
        user={user}
        embedToolbar={chromeToolbar}
        showTeamChat={staff}
        topBarActions={topBarActions}
      />
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
        hideNavSeparator={chromeToolbar}
        sidebar={
          <AgentSidebar
            user={user}
            showUsersNav={showUsersNav}
            collapsed={collapsed}
            onToggle={toggle}
            chromeCompactNav={chromeToolbar}
          />
        }
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
          {chromeToolbar && isHomeLanding ? null : (
            <div
              className={
                chromeToolbar
                  ? "team-chat-shell-header team-chat-shell-header--chrome-title"
                  : "team-chat-shell-header"
              }
            >
              <AgentTopBar
                title={topBarTitle}
                actions={topBarActions}
                user={user}
                onOpenNav={openMobileNav}
                hideActions={chromeToolbar}
                chromeTitle={chromeToolbar}
                navCollapsed={collapsed}
                onToggleNav={toggle}
              />
            </div>
          )}
          <PageLayoutEditMainChrome>
            <AgentErrorBoundary>{children}</AgentErrorBoundary>
            <ReviewNotesOverlay user={user ?? null} />
          </PageLayoutEditMainChrome>
        </div>
      </AgentShellColumns>
      {staff ? (
        <TeamChatFloatPanel open={showChatDock}>
          <ChatWorkspacePanel layout="float" />
        </TeamChatFloatPanel>
      ) : null}
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
