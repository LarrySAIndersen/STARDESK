import { redirect } from "next/navigation";

import { ProjekterHubPage } from "@/components/projekter/projekter-hub-page";
import { TicketListShell } from "@/components/ticket-list-shell";
import { isStaff } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function ProjekterPage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/");
  }
  if (!isStaff(user)) {
    redirect("/portal");
  }

  return (
    <TicketListShell>
      <ProjekterHubPage />
    </TicketListShell>
  );
}
