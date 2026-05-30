import { notFound, redirect } from "next/navigation";

import { AdminUserDetail } from "@/components/admin-user-detail";
import { ApiError } from "@/lib/api";
import { apiGetServer } from "@/lib/api-server";
import { canManageUsers } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";
import type { UserAdminRead, UserTicketsGrouped } from "@/types/admin-user";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await getServerUser();
  const { id } = await params;
  const isSelf = currentUser?.id === id;

  if (!canManageUsers(currentUser) && !isSelf) {
    redirect("/");
  }

  try {
    const [user, userTickets] = await Promise.all([
      apiGetServer<UserAdminRead>(`/api/v1/users/${id}`),
      apiGetServer<UserTicketsGrouped>(`/api/v1/users/${id}/tickets`),
    ]);

    return (
      <div className="wire-scroll-content min-h-0 flex-1">
        <p className="text-muted-foreground mb-6 text-sm">
          Brugerprofil med metadata og tilknyttede sager.
        </p>
        <AdminUserDetail user={user} userTickets={userTickets} />
      </div>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    return (
      <div className="wire-scroll-content min-h-0 flex-1">
        <p className="text-destructive text-sm">
          {error instanceof ApiError
            ? `API-fejl (${error.status}).`
            : "Kunne ikke hente brugerprofilen."}
        </p>
      </div>
    );
  }
}
