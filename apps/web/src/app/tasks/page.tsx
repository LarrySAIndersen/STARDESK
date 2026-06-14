import { redirect } from "next/navigation";

import { RecurringTasksPanel } from "@/components/recurring-tasks-panel";
import { ApiError } from "@/lib/api";
import { apiGetServer } from "@/lib/api-server";
import { isStaff } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";
import type { Category } from "@/types/category";
import type { Team } from "@/types/team";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const currentUser = await getServerUser();
  if (!isStaff(currentUser)) {
    redirect("/");
  }

  let teams: Team[] = [];
  let categories: Category[] = [];
  let error: string | null = null;

  try {
    [teams, categories] = await Promise.all([
      apiGetServer<Team[]>("/api/v1/teams"),
      apiGetServer<Category[]>("/api/v1/categories"),
    ]);
  } catch (err) {
    if (err instanceof ApiError) {
      error = err.message;
    } else {
      error = "Kunne ikke hente data til opgaver";
    }
  }

  return (
    <div className="wire-scroll-content space-y-4 px-4 py-4">
      <header>
        <h1 className="text-star-navy text-2xl font-bold tracking-tight">Opgaver</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Gentagne opgaver (Wreck ind) opretter sager automatisk efter den valgte frekvens.
        </p>
      </header>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <RecurringTasksPanel teams={teams} categories={categories} />
    </div>
  );
}
