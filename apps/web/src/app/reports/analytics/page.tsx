import Link from "next/link";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";

import { getServerUser } from "@/lib/auth-server";
import { isStaff } from "@/lib/auth";

const AnalyticsDashboardClient = dynamic(
  () => import("@/components/analytics-dashboard-client").then((mod) => mod.AnalyticsDashboardClient),
  {
    loading: () => (
      <p className="text-muted-foreground text-sm" aria-live="polite">
        Henter analysedashboard…
      </p>
    ),
  },
);

export default async function AnalyticsPage() {
  const currentUser = await getServerUser();

  if (!isStaff(currentUser)) {
    redirect("/");
  }

  return (
    <div className="wire-scroll-content min-h-0 flex-1 space-y-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/reports" className="hover:underline">
          Standardrapporter
        </Link>
        <span>/</span>
        <span className="text-star-navy font-semibold">Avanceret Sagsanalyse & Observability</span>
      </div>
      <AnalyticsPageContent />
    </div>
  );
}

function AnalyticsPageContent() {
  return <AnalyticsDashboardClient />;
}
