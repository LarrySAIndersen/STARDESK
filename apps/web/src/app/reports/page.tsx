import Link from "next/link";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";

import { getServerUser } from "@/lib/auth-server";
import { isStaff } from "@/lib/auth";

const ReportsDashboard = dynamic(
  () => import("@/components/reports-dashboard").then((mod) => mod.ReportsDashboard),
  {
    loading: () => (
      <p className="text-muted-foreground text-sm" aria-live="polite">
        Henter rapport…
      </p>
    ),
  },
);

export default async function ReportsPage() {
  const currentUser = await getServerUser();

  if (!isStaff(currentUser)) {
    redirect("/");
  }

  return (
    <div className="wire-scroll-content min-h-0 flex-1 space-y-6">
      <p className="text-muted-foreground text-sm">
        Standardrapporter for Service Desk Manager. For live KPI&apos;er og sagspipeline, se{" "}
        <Link href="/" className="text-star-blue font-medium hover:underline">
          Driftsdashboard
        </Link>
        .
      </p>
      <ReportsDashboard />
    </div>
  );
}
