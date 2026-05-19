import { TicketsListClient } from "@/components/tickets-list-client";
import { apiGetServer } from "@/lib/api-server";
import { buildTicketsApiQuery, dashboardFilterTitle } from "@/lib/tickets-api-query";
import type { Ticket } from "@/types/ticket";

export const dynamic = "force-dynamic";

export default async function TicketsListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const apiQuery = buildTicketsApiQuery(params);
  const filterTitle = dashboardFilterTitle(params);

  let tickets: Ticket[] = [];
  let fetchError: string | null = null;

  try {
    tickets = await apiGetServer<Ticket[]>(`/api/v1/tickets?${apiQuery}`);
  } catch {
    fetchError = "Kunne ikke hente sager fra API.";
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="wire-scroll-content min-h-0 flex-1">
        {filterTitle ? (
          <p className="text-muted-foreground mb-3 text-sm">
            Filter: <span className="text-star-navy font-medium">{filterTitle}</span>
          </p>
        ) : null}
        {fetchError ? (
          <p className="text-star-red text-sm" role="alert">
            {fetchError}
          </p>
        ) : (
          <TicketsListClient tickets={tickets} initialParams={params} />
        )}
      </div>
    </div>
  );
}
