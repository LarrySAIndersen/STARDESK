import { redirect } from "next/navigation";

import { AdminCategoriesPanel } from "@/components/admin-categories-panel";
import { canManageUsers } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
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
        <h1 className="text-star-navy text-2xl font-bold tracking-tight">Kategorier</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Administrer kategorier og underkategorier for alle sager. Synkroniser standardlisten,
          rediger eksisterende, eller udfyld sager der mangler kategori (standard: Andet /
          Generelt).
        </p>
      </header>
      <AdminCategoriesPanel />
    </div>
  );
}
