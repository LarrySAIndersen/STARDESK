import Link from "next/link";

import { MajorTicketsBoard } from "@/components/major-tickets-board";
import { apiGetServer } from "@/lib/api-server";
import { ticketOverviewHref } from "@/lib/ticket-connections";
import type { Ticket } from "@/types/ticket";

export const dynamic = "force-dynamic";

export default async function MajorTicketsPage() {
  let tickets: Ticket[] = [];
  let fetchError: string | null = null;

  try {
    tickets = await apiGetServer<Ticket[]>("/api/v1/tickets?is_store=true&limit=500");
  } catch {
    fetchError = "Kunne ikke hente store sager fra API.";
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="wire-scroll-content min-h-0 flex-1 space-y-4">
        <Link
          href="/tickets"
          className="text-[var(--gray-mid)] hover:text-star-navy inline-flex items-center gap-1 text-xs font-medium"
        >
          ← Tilbage til sager
        </Link>

        <header className="wire-card mb-0">
          <p className="wire-card-title mb-0">Stor sag</p>
          <h1 className="text-star-navy mt-2 text-xl font-bold tracking-tight md:text-2xl">
            Alle store sager
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Overblik over åbne og afsluttede store sager. Klik en sag for at se tilknyttede sager.
          </p>
        </header>

        {fetchError ? (
          <p className="text-star-red text-sm" role="alert">
            {fetchError}
          </p>
        ) : (
          <MajorTicketsBoard tickets={tickets} overviewHref={ticketOverviewHref} />
        )}
      </div>
    </div>
  );
}
