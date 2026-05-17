import { cookies } from "next/headers";

import { AgentShell } from "@/components/agent/agent-shell";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { isStaff, TOKEN_COOKIE, USER_COOKIE } from "@/lib/auth";
import type { User } from "@/types/user";

export async function AgentShellWrapper({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  const userCookie = cookieStore.get(USER_COOKIE)?.value;

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

  let currentUser: User | null = null;
  if (userCookie) {
    try {
      currentUser = JSON.parse(decodeURIComponent(userCookie)) as User;
    } catch {
      currentUser = null;
    }
  }

  if (isStaff(currentUser)) {
    return (
      <main id="main-content" tabIndex={-1} className="flex min-h-0 flex-1 flex-col outline-none">
        <AgentShell>{children}</AgentShell>
      </main>
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
