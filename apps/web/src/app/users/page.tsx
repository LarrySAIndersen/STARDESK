import Link from "next/link";

import { AdminUsersPanel } from "@/components/admin-users-panel";
import { canManageUsers } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function UsersAdminPage() {
  const currentUser = await getServerUser();

  if (!canManageUsers(currentUser)) {
    redirect("/");
  }

  return (
    <div className="wire-scroll-content min-h-0 flex-1">
      <p className="text-muted-foreground mb-6 max-w-2xl text-sm">
        Administrer konti, rettighedsgrupper, gruppemedlemskaber og adgangskoder. CSV-import af
        brugere findes under{" "}
        <Link href="/admin/dashboard" className="text-star-navy font-medium underline">
          Admin dashboard
        </Link>
        .
      </p>
      <AdminUsersPanel currentUserRole={currentUser!.role} />
    </div>
  );
}
