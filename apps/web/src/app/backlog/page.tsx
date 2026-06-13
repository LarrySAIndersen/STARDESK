import Link from "next/link";

import { ClickableMetric } from "@/components/dashboard/clickable-metric";
import { BacklogTicketsListClient } from "@/components/backlog/backlog-tickets-list-client";
import { buildTicketsFilterHref } from "@/lib/dashboard-ticket-links";
import { apiGetServer } from "@/lib/api-server";
import { getServerUser } from "@/lib/auth-server";
import type { Ticket } from "@/types/ticket";

export const dynamic = "force-dynamic";

export default async function BacklogPage() {
  const user = await getServerUser();
  let tickets: Ticket[] = [];
  let fetchError: string | null = null;

  try {
    tickets = await apiGetServer<Ticket[]>("/api/v1/tickets?bucket=modtaget&limit=500");
  } catch {
    fetchError = "Kunne ikke hente backlog fra API.";
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
          <p className="wire-card-title mb-0">Backlog</p>
          <h1 className="text-star-navy mt-2 text-xl font-bold tracking-tight md:text-2xl">
            Modtagne sager
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Sager i status ny eller tildelt, som afventer behandling i køen.
            {!fetchError && tickets.length > 0 ? (
              <>
                {" "}
                <ClickableMetric
                  href={buildTicketsFilterHref({ scope: "all", bucket: "modtaget" })}
                  inline
                  ariaLabel={`${tickets.length} sager i backlog`}
                >
                  ({tickets.length} i listen)
                </ClickableMetric>
              </>
            ) : null}
          </p>
        </header>

        {fetchError ? (
          <p className="text-star-red text-sm" role="alert">
            {fetchError}
          </p>
        ) : (
          <BacklogTicketsListClient tickets={tickets} currentUserId={user?.id} />
        )}
      </div>
    </div>
  );
}
