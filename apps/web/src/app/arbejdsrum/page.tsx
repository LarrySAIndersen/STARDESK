import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AgentMainLoading } from "@/components/agent/agent-main-loading";
import { WorkspaceLanding } from "@/components/workspace-landing/workspace-landing";
import { TicketListShell } from "@/components/ticket-list-shell";
import { getServerUser } from "@/lib/auth-server";
import { isStaff, TOKEN_COOKIE } from "@/lib/auth";
import {
  classicHomePath,
  parseUiMode,
  UI_MODE_COOKIE,
} from "@/lib/classic-ui-mode";

export const dynamic = "force-dynamic";

export default async function ArbejdsrumPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;

  if (!token) {
    redirect("/");
  }

  const currentUser = await getServerUser();
  if (!currentUser || !isStaff(currentUser)) {
    redirect("/");
  }

  if (parseUiMode(cookieStore.get(UI_MODE_COOKIE)?.value) === "classic") {
    redirect(classicHomePath());
  }

  return (
    <TicketListShell>
      <Suspense fallback={<AgentMainLoading />}>
        <WorkspaceLanding />
      </Suspense>
    </TicketListShell>
  );
}
