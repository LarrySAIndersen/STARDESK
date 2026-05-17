import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { PageHero } from "@/components/page-hero";
import { ReportsDashboard } from "@/components/reports-dashboard";
import { isStaff, USER_COOKIE } from "@/lib/auth";
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
    redirect("/login");
  }

  return (
    <main className="star-page">
      <PageHero
        title="Rapporter"
        lead="Standardrapporter for Service Desk Manager — modtaget, igangsat, løst, lukket og genåbnet."
      />
      <ReportsDashboard />
    </main>
  );
}
