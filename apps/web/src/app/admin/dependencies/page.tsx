import { redirect } from "next/navigation";

import { AdminDependenciesPanel } from "@/components/admin-dependencies-panel";
import { isAdmin } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";

export default async function AdminDependenciesPage() {
  const currentUser = await getServerUser();

  if (!isAdmin(currentUser)) {
    redirect("/");
  }

  return (
    <div className="wire-scroll-content min-h-0 flex-1 space-y-4">
      <p className="text-muted-foreground max-w-3xl text-sm">
        Overvåg tredjepartsbiblioteker, egne monorepo-moduler og kendte CVE&apos;er med CVSS-score.
        Rapporten caches i op til én time — brug &quot;Kør kontrol nu&quot; for at opdatere.
      </p>
      <AdminDependenciesPanel />
    </div>
  );
}
