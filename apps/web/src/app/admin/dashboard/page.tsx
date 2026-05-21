import { redirect } from "next/navigation";

import { AdminDashboardPanel } from "@/components/admin-dashboard-panel";
import { canManageUsers, normalizeUserRole } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/");
  }
  if (!canManageUsers(user)) {
    redirect("/");
  }

  const role = normalizeUserRole(user.role) ?? "admin";

  return (
    <div className="wire-scroll-content space-y-4 px-4 py-4">
      <header>
        <h1 className="text-star-navy text-2xl font-bold tracking-tight">
          Administrativt dashboard
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Import af brugere og TOPdesk-sager, samt genveje til administration.
        </p>
      </header>
      <AdminDashboardPanel currentUserRole={role} />
    </div>
  );
}
