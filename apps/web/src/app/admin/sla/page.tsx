import { redirect } from "next/navigation";

import { AdminSlaPanel } from "@/components/admin-sla-panel";
import { canManageUsers } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function AdminSlaPage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/");
  }
  if (!canManageUsers(user)) {
    redirect("/");
  }

  return (
    <div className="wire-scroll-content space-y-4 px-4 py-4">
      <header>
        <h1 className="text-star-navy text-2xl font-bold tracking-tight">SLA-indstillinger</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Konfigurer standard P1–P4, pause ved på hold, hvilke modtagergrupper der udløser SLA, og
          database-politikker. SLA genberegnes ved prioritetsændring og via{" "}
          <code className="text-xs">POST /api/v1/admin/reset-sla</code>.
        </p>
      </header>
      <AdminSlaPanel />
    </div>
  );
}
