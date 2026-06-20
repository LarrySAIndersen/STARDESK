import Link from "next/link";
import { redirect } from "next/navigation";

import { WorkboardBacklogClient } from "@/components/workboard/workboard-backlog-client";
import { apiGetServer } from "@/lib/api-server";
import { isStaff } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";
import type { WorkboardTask } from "@/types/workboard";

export const dynamic = "force-dynamic";

export default async function WorkboardPage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/login");
  }
  if (!isStaff(user)) {
    redirect("/portal");
  }

  let tasks: WorkboardTask[] = [];
  let fetchError: string | null = null;

  try {
    tasks = await apiGetServer<WorkboardTask[]>("/api/v1/workboard/tasks");
  } catch {
    fetchError = "Kunne ikke hente opgaver fra API.";
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="wire-scroll-content min-h-0 flex-1 space-y-4">
        <Link
          href="/projekter"
          className="text-[var(--gray-mid)] hover:text-star-navy inline-flex items-center gap-1 text-xs font-medium"
        >
          ← Tilbage til projektoversigt
        </Link>

        <header className="wire-card mb-0">
          <p className="wire-card-title mb-0">Opgaver</p>
          <h1 className="text-star-navy mt-2 text-xl font-bold tracking-tight md:text-2xl">
            Til senere
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Online backlog — gem opgaver I vil løse senere, start arbejde og marker færdig.
            Synkroniseret til databasen (ikke kun en fil på din PC).
          </p>
        </header>

        {fetchError ? (
          <p className="text-star-red text-sm" role="alert">
            {fetchError}
          </p>
        ) : (
          <WorkboardBacklogClient initialTasks={tasks} />
        )}
      </div>
    </div>
  );
}
