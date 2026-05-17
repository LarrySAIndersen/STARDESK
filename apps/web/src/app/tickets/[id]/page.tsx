import Link from "next/link";
import { notFound } from "next/navigation";

import { TicketDetailView } from "@/components/ticket-detail";
import { ApiError } from "@/lib/api";
import { apiGetServer } from "@/lib/api-server";
import { cookies } from "next/headers";
import { isStaff, USER_COOKIE } from "@/lib/auth";
import type { Team } from "@/types/team";
import type { User } from "@/types/user";
import type { TicketDetail } from "@/types/ticket";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const userCookie = (await cookies()).get(USER_COOKIE)?.value;
  let currentUser: User | null = null;
  if (userCookie) {
    try {
      currentUser = JSON.parse(decodeURIComponent(userCookie)) as User;
    } catch {
      currentUser = null;
    }
  }

  const staff = isStaff(currentUser);

  try {
    const [ticket, teams] = await Promise.all([
      apiGetServer<TicketDetail>(`/api/v1/tickets/${id}`),
      staff
        ? apiGetServer<Team[]>("/api/v1/teams", { revalidate: 120 }).catch(() => [] as Team[])
        : Promise.resolve([] as Team[]),
    ]);
    return (
      <main className="star-page max-w-7xl">
        <TicketDetailView ticket={ticket} currentUser={currentUser} teams={teams} />
      </main>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    if (error instanceof ApiError && error.status === 403) {
      return (
        <main className="star-page max-w-7xl">
          <p className="text-destructive text-sm">
            Du har ikke adgang til denne sag. Log ind med en bruger der har adgang, eller gå
            tilbage til{" "}
            <Link href="/" className="text-star-blue underline">
              oversigten
            </Link>
            .
          </p>
        </main>
      );
    }
    return (
      <main className="star-page max-w-7xl">
        <p className="text-destructive text-sm">
          Kunne ikke hente sagen. Tjek at API&apos;et kører.
        </p>
      </main>
    );
  }
}
