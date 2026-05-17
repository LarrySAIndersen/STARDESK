import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import dynamic from "next/dynamic";

import { PageHero } from "@/components/page-hero";
import { isStaff, USER_COOKIE } from "@/lib/auth";

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
import type { User } from "@/types/user";

export default async function ReportsPage() {
  const userCookie = (await cookies()).get(USER_COOKIE)?.value;
  let currentUser: User | null = null;
  if (userCookie) {
    try {
      currentUser = JSON.parse(decodeURIComponent(userCookie)) as User;
    } catch {
      currentUser = null;
    }
  }

  if (!isStaff(currentUser)) {
    redirect("/");
  }

  return (
    <main className="mx-auto w-full max-w-7xl">
      <PageHero
        title="Rapporter"
        lead="Standardrapporter for Service Desk Manager — modtaget, igangsat, løst, lukket og genåbnet."
      />
      <div className="space-y-8">
        <ReportsDashboard />
      </div>
    </main>
  );
}
