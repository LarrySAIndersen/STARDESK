import Link from "next/link";
import { notFound } from "next/navigation";

import { TicketConnectionOverview } from "@/components/ticket-connection-overview";
import { ApiError } from "@/lib/api";
import { apiGetServer } from "@/lib/api-server";
import type { TicketDetail } from "@/types/ticket";

export const dynamic = "force-dynamic";

export default async function TicketOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const ticket = await apiGetServer<TicketDetail>(`/api/v1/tickets/${id}`);
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <TicketConnectionOverview ticket={ticket} />
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
            Du har ikke adgang til denne sag. Gå tilbage til{" "}
            <Link href="/tickets" className="text-star-blue underline">
              sager
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
          <Link href="/tickets" className="text-star-blue underline">
            sager
          </Link>
          .
        </p>
      </div>
    );
  }
}
