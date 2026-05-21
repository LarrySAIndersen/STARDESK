import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { AgentShell } from "@/components/agent/agent-shell";
import { ClientSessionHydrator } from "@/components/client-session-hydrator";
import { CaseAssistantShellClient } from "@/components/portal/case-assistant-shell-client";
import { SfChatShellClient } from "@/components/sf-chat/sf-chat-shell-client";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { canManageUsers, isStaff, TOKEN_COOKIE } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";
import {
  CHANGE_PASSWORD_PATH,
  isPasswordChangeExemptPath,
  userMustChangePassword,
} from "@/lib/must-change-password";
import { isStaffPathBlockedForUser } from "@/lib/sidebar-nav-visibility-server";

export async function AgentShellWrapper({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;

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
  const pathname = (await headers()).get("x-pathname") ?? "";
  const onChangePasswordPage = isPasswordChangeExemptPath(pathname);

  if (userMustChangePassword(currentUser) && !onChangePasswordPage) {
    redirect(CHANGE_PASSWORD_PATH);
  }

  const showUsersNav = canManageUsers(currentUser);

  if (pathname.startsWith("/classic")) {
    return (
      <>
        <ClientSessionHydrator />
        {children}
      </>
    );
  }

  if (userMustChangePassword(currentUser) && onChangePasswordPage) {
    return (
      <>
        <SiteHeader
          user={currentUser}
          shellVariant="firstLoginIndustrial"
          hideCasesAndNewTicketNav
        />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex flex-1 flex-col bg-[#0a0e1a] outline-none"
        >
          {children}
        </main>
        <SiteFooter variant="firstLoginIndustrial" />
      </>
    );
  }

  if (isStaff(currentUser)) {
    if (await isStaffPathBlockedForUser(pathname, currentUser)) {
      redirect("/");
    }
    return (
      <div className="flex h-dvh min-h-0 w-full flex-1 flex-col overflow-hidden">
        <ClientSessionHydrator />
        <AgentShell user={currentUser} showUsersNav={showUsersNav}>
          {children}
        </AgentShell>
        <SfChatShellClient user={currentUser} />
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
      <SfChatShellClient user={currentUser} />
    </>
  );
}
