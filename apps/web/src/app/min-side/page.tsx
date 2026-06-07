import Link from "next/link";
import { redirect } from "next/navigation";

import { UserAvatar } from "@/components/agent/user-avatar";
import { MinSideWorkspace } from "@/components/personal/min-side-workspace";
import { buttonVariants } from "@/components/ui/button";
import { getServerUser } from "@/lib/auth-server";
import { apiGetServer } from "@/lib/api-server";
import { cn } from "@/lib/utils";
import type { UserTicketsGrouped } from "@/types/admin-user";
import type { PersonalKanban, PersonalNote } from "@/types/personal";

export const dynamic = "force-dynamic";

export default async function MinSidePage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/");
  }

  const [notes, kanban, userTickets] = await Promise.all([
    apiGetServer<PersonalNote[]>("/api/v1/personal/notes").catch(() => [] as PersonalNote[]),
    apiGetServer<PersonalKanban>("/api/v1/personal/kanban").catch(
      () =>
        ({
          columns: ["Min kø", "I gang", "Færdig"],
          cards: [],
          tickets: [],
        }) satisfies PersonalKanban,
    ),
    apiGetServer<UserTicketsGrouped>(`/api/v1/users/${user.id}/tickets?limit=50`).catch(
      () =>
        ({
          reported: [],
          assigned: [],
          affected: [],
          interested: [],
          mentioned: [],
        }) satisfies UserTicketsGrouped,
    ),
  ]);

  const assignableTickets = [
    ...userTickets.assigned,
    ...userTickets.reported.filter((t) => !userTickets.assigned.some((a) => a.id === t.id)),
  ];

  return (
    <div className="wire-scroll-content min-h-0 flex-1 p-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <UserAvatar user={user} size="lg" />
          <div>
            <h1 className="wire-sec-title text-xl">Min side</h1>
            <p className="text-muted-foreground text-sm">
              Hej {user.display_name} — dit personlige overblik med noter, sager og kanban.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/profile"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Profil
          </Link>
          <Link href="/tickets/new" className={cn(buttonVariants({ size: "sm" }))}>
            Opret sag
          </Link>
        </div>
      </header>

      <MinSideWorkspace
        initialNotes={notes}
        initialKanban={kanban}
        userTickets={userTickets}
        assignableTickets={assignableTickets}
      />
    </div>
  );
}
