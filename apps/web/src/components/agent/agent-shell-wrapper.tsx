import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { AgentShell } from "@/components/agent/agent-shell";
import { ClientSessionHydrator } from "@/components/client-session-hydrator";
import { CaseAssistantShellClient } from "@/components/portal/case-assistant-shell-client";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { canManageUsers, hasAgentShellAccess, isStaff, TOKEN_COOKIE } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";
import {
  firstAllowedStaffPathForUser,
  isStaffPathBlockedForUser,
} from "@/lib/sidebar-nav-visibility-server";

function isStandaloneLoginPath(pathname: string): boolean {
  if (pathname === "/portal") return true;
  if (pathname === "/kundeportal-2" || pathname.startsWith("/kundeportal-2/")) return true;
  return pathname === "/login/helpdesk" || pathname.startsWith("/login/helpdesk/");
}

export async function AgentShellWrapper({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  const pathname = (await headers()).get("x-pathname") ?? "";

  if (!token && isStandaloneLoginPath(pathname)) {
    return <>{children}</>;
  }

  if (!token) {
    return (
      <>
        <SiteHeader user={null} />
        <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <SiteFooter />
      </>
    );
  }

  const currentUser = await getServerUser();

  const showUsersNav = canManageUsers(currentUser);

  if (pathname.startsWith("/classic")) {
    return (
      <>
        <ClientSessionHydrator />
        {children}
      </>
    );
  }

  if (pathname === "/kundeportal-2" || pathname.startsWith("/kundeportal-2/")) {
    return (
      <>
        <ClientSessionHydrator />
        {children}
      </>
    );
  }

  if (hasAgentShellAccess(currentUser)) {
    if (isStaff(currentUser) && (await isStaffPathBlockedForUser(pathname, currentUser))) {
      redirect(await firstAllowedStaffPathForUser(currentUser));
    }
    return (
      <div className="flex h-dvh min-h-0 w-full flex-1 flex-col overflow-hidden">
        <ClientSessionHydrator />
        <AgentShell
          user={currentUser}
          showUsersNav={showUsersNav}
          showPageLayoutEdit={false}
        >
          {children}
        </AgentShell>
        <CaseAssistantShellClient user={currentUser} />
      </div>
    );
  }

  return (
    <>
      <ClientSessionHydrator />
      <SiteHeader user={currentUser} />
      <main id="main-content" tabIndex={-1} className="bg-background flex-1 outline-none">
        {children}
      </main>
      <SiteFooter />
      <CaseAssistantShellClient user={currentUser} />
    </>
  );
}
