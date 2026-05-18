import Link from "next/link";

import { StarSectionCard } from "@/components/star/section-card";
import { Badge } from "@/components/ui/badge";
import { statusLabel } from "@/lib/ticket-labels";
import type { Ticket } from "@/types/ticket";

const COLUMNS: { key: string; title: string; statuses: string[] }[] = [
  { key: "new", title: "Ny", statuses: ["new", "assigned"] },
  { key: "active", title: "I gang", statuses: ["in_progress", "on_hold"] },
  { key: "done", title: "Afsluttet", statuses: ["resolved", "closed", "cancelled"] },
];

export function MajorTicketsBoard({
  tickets,
  overviewHref,
}: {
  tickets: Ticket[];
  overviewHref?: (ticketId: string) => string;
}) {
  const major = tickets.filter((ticket) => Boolean(ticket.is_major));

  return (
    <StarSectionCard
      variant="accent"
      title="Stor sag"
      description={`${major.length} stor${major.length === 1 ? "" : "e"} sag${major.length === 1 ? "" : "er"} — kolonnevisning`}
    >
      {major.length === 0 ? (
        <p className="text-muted-foreground text-sm">Ingen store sager lige nu.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {COLUMNS.map((column) => {
            const columnTickets = major.filter((ticket) =>
              column.statuses.includes(ticket.status),
            );
            return (
              <div key={column.key}>
                <p className="text-star-navy mb-2 border-b border-star-blue/30 pb-1 text-xs font-bold uppercase tracking-wide">
                  {column.title}
                </p>
                <ul className="space-y-2">
                  {columnTickets.length === 0 ? (
                    <li className="text-muted-foreground text-xs">—</li>
                  ) : (
                    columnTickets.map((ticket) => (
                      <li key={ticket.id}>
                        <Link
                          href={
                            overviewHref ? overviewHref(ticket.id) : `/tickets/${ticket.id}`
                          }
                          className="border-star-blue/20 hover:border-star-blue block rounded-sm border bg-white p-3 text-sm shadow-sm transition-shadow hover:shadow-md"
                        >
                          <p className="text-star-blue font-mono text-[10px] font-semibold">
                            {ticket.ticket_number}
                          </p>
                          <p className="text-star-navy mt-1 line-clamp-2 font-medium leading-snug">
                            {ticket.title}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <Badge
                              variant="outline"
                              className="border-star-blue text-star-blue text-[10px]"
                            >
                              {statusLabel(ticket.status)}
                            </Badge>
                            {(ticket.sub_causes ?? []).slice(0, 2).map((sc) => (
                              <Badge
                                key={sc.id}
                                className="bg-star-blue-light text-star-navy text-[10px]"
                              >
                                {sc.name_da}
                              </Badge>
                            ))}
                          </div>
                        </Link>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </StarSectionCard>
  );
}
