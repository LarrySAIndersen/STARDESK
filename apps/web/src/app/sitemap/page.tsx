import { redirect } from "next/navigation";

import { WorkspaceSitemapPage } from "@/components/workspace-landing/workspace-sitemap-page";
import { TicketListShell } from "@/components/ticket-list-shell";
import { isStaff } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function SitemapPage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/");
  }
  if (!isStaff(user)) {
    redirect("/portal");
  }

  return (
    <TicketListShell>
      <WorkspaceSitemapPage user={user} />
    </TicketListShell>
  );
}
