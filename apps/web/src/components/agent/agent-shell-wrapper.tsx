import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { AgentShell } from "@/components/agent/agent-shell";
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

export async function AgentShellWrapper({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;

  if (!token) {
    return (
      <>
        <SiteHeader />
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

  if (userMustChangePassword(currentUser) && onChangePasswordPage) {
    return (
      <>
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <SiteFooter />
      </>
    );
  }

  if (isStaff(currentUser)) {
    return (
      <div className="flex h-dvh min-h-0 w-full flex-1 flex-col overflow-hidden">
        <AgentShell user={currentUser} showUsersNav={showUsersNav}>
          {children}
        </AgentShell>
        <SfChatShellClient user={currentUser} />
      </div>
    );
  }

  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="bg-background flex-1 outline-none">
        {children}
      </main>
      <SiteFooter />
      <SfChatShellClient user={currentUser} />
    </>
  );
}
