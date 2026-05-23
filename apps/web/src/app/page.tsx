import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { AgentMainLoading } from "@/components/agent/agent-main-loading";
import { AgentWorkspace } from "@/components/agent-workspace";
import { EndUserTicketPortal } from "@/components/end-user-ticket-portal";
import { TicketListShell } from "@/components/ticket-list-shell";
import { TicketListSkeleton } from "@/components/ticket-list-skeleton";
import { getServerUser } from "@/lib/auth-server";
import { isStaff, TOKEN_COOKIE } from "@/lib/auth";
import {
  classicHomePath,
  parseUiMode,
  UI_MODE_COOKIE,
} from "@/lib/classic-ui-mode";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;

  if (!token) {
    return (
      <div className="star-page px-6 py-10">
        <LoginForm />
      </div>
    );
  }

  const currentUser = await getServerUser();
  const staff = isStaff(currentUser);

  if (staff && parseUiMode(cookieStore.get(UI_MODE_COOKIE)?.value) === "classic") {
    redirect(classicHomePath());
  }

  if (staff) {
    return (
      <TicketListShell>
        <Suspense fallback={<AgentMainLoading />}>
          <AgentWorkspace />
        </Suspense>
      </TicketListShell>
    );
  }

  return (
    <main className="star-page">
      <Suspense fallback={<TicketListSkeleton />}>
        <TicketListShell>
          <EndUserTicketPortal currentUser={currentUser} />
        </TicketListShell>
      </Suspense>
    </main>
  );
}
