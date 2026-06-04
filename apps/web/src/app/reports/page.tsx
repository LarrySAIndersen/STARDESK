import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth-server";
import { isStaff } from "@/lib/auth";
import { ReportsPageClient } from "@/components/reports-page-client";

export default async function ReportsPage() {
  const currentUser = await getServerUser();

  if (!isStaff(currentUser)) {
    redirect("/");
  }

  return (
    <div className="wire-scroll-content min-h-0 flex-1 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
        <p className="text-muted-foreground text-sm">
          Rapporteringscenter for Service Desk Manager. For live KPI&apos;er og sagspipeline, se{" "}
          <Link href="/" className="text-star-blue font-medium hover:underline">
            Driftsdashboard
          </Link>
          .
        </p>
        <Link
          href="/reports/analytics"
          className="inline-flex items-center justify-center rounded-sm bg-star-blue px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-star-navy transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-star-blue"
        >
          Avanceret Sagsanalyse & Observability &rarr;
        </Link>
      </div>
      <ReportsPageClient />
    </div>
  );
}
