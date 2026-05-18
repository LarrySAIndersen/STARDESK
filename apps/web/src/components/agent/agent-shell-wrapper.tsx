import { cookies } from "next/headers";

import { AgentShell } from "@/components/agent/agent-shell";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { canManageUsers, isStaff, TOKEN_COOKIE } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";

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
  const showUsersNav = canManageUsers(currentUser);

  if (isStaff(currentUser)) {
    return (
      <div className="flex h-dvh min-h-0 w-full flex-1 flex-col overflow-hidden">
        <AgentShell user={currentUser} showUsersNav={showUsersNav}>
          {children}
        </AgentShell>
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
    </>
  );
}
