import Link from "next/link";

import { WireStatusBadge } from "@/components/wireframe/wire-badge";
import { formatDateTimeDa } from "@/lib/utils";
import type { Ticket } from "@/types/ticket";

export function PortalMyTicketsTable({ tickets }: { tickets: Ticket[] }) {
  if (tickets.length === 0) {
    return null;
  }

  return (
    <div className="wire-table-wrap min-w-0">
      <div className="wire-table-scroll wire-table-scroll--portal">
        <div
          className="wire-table-head wire-table-grid-portal-tickets"
          role="row"
        >
          <span>Sagsnr</span>
          <span>Titel</span>
          <span>Status</span>
          <span>Oprettet</span>
        </div>
        {tickets.map((ticket) => (
          <Link
            key={ticket.id}
            href={`/tickets/${ticket.id}`}
            className="wire-table-row wire-table-grid-portal-tickets items-center"
            role="row"
          >
            <span className="text-[var(--gray-mid)] font-mono text-xs font-semibold">
              {ticket.ticket_number}
            </span>
            <span className="min-w-0 truncate text-[13px] font-medium" title={ticket.title}>
              {ticket.title}
            </span>
            <span>
              <WireStatusBadge status={ticket.status} />
            </span>
            <span className="text-[var(--gray-mid)] truncate text-[11px] tabular-nums">
              {formatDateTimeDa(ticket.created_at)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
