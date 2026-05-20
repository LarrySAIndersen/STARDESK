import Link from "next/link";
import { notFound } from "next/navigation";

import { TicketDetailView } from "@/components/ticket-detail";
import { ApiError } from "@/lib/api";
import { apiGetServer } from "@/lib/api-server";
import { getServerUser } from "@/lib/auth-server";
import { isStaff } from "@/lib/auth";
import type { Category } from "@/types/category";
import type { Team } from "@/types/team";
import type { TicketDetail } from "@/types/ticket";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentUser = await getServerUser();
  const staff = isStaff(currentUser);

  try {
    const [ticket, teams, categories] = await Promise.all([
      apiGetServer<TicketDetail>(`/api/v1/tickets/${id}`),
      staff
        ? apiGetServer<Team[]>("/api/v1/teams").catch(() => [] as Team[])
        : Promise.resolve([] as Team[]),
      staff
        ? apiGetServer<Category[]>("/api/v1/categories").catch(() => [] as Category[])
        : Promise.resolve([] as Category[]),
    ]);
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <TicketDetailView
          ticket={ticket}
          currentUser={currentUser}
          teams={teams}
          categories={categories}
        />
      </div>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    if (error instanceof ApiError && error.status === 403) {
      return (
        <div className="wire-scroll-content star-page max-w-7xl">
          <p className="text-destructive text-sm">
            Du har ikke adgang til denne sag. Log ind med en bruger der har adgang, eller gå
            tilbage til{" "}
            <Link href="/" className="text-star-blue underline">
              oversigten
            </Link>
            .
          </p>
        </div>
      );
    }
    const detail =
      error instanceof ApiError
        ? `Kunne ikke hente sagen (API ${error.status}).`
        : "Kunne ikke hente sagen.";
    return (
      <div className="wire-scroll-content star-page max-w-7xl">
        <p className="text-destructive text-sm">
          {detail} Prøv igen om et øjeblik, eller gå tilbage til{" "}
          <Link href="/" className="text-star-blue underline">
            oversigten
          </Link>
          .
        </p>
      </div>
    );
  }
}
