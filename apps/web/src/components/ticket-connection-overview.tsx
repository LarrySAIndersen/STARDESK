import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { ticketOverviewHref } from "@/lib/ticket-connections";
import { priorityLabel, statusLabel } from "@/lib/ticket-labels";
import type { TicketDetail, TicketSummary } from "@/types/ticket";

function Connector() {
  return <div aria-hidden className="bg-star-navy/25 mx-auto h-6 w-px" />;
}

function OverviewNode({
  ticket,
  emphasis = false,
  label,
}: {
  ticket:
    | TicketSummary
    | Pick<TicketDetail, "id" | "ticket_number" | "title" | "status" | "priority" | "is_major">;
  emphasis?: boolean;
  label?: string;
}) {
  return (
    <Link
      href={ticketOverviewHref(ticket.id)}
      className={
        emphasis
          ? "border-star-red ring-star-navy/10 hover:border-star-navy block min-w-[14rem] max-w-md flex-1 rounded-[2px] border-2 bg-white p-4 shadow-md ring-2 transition-shadow hover:shadow-lg"
          : "border-star-blue/25 hover:border-star-blue block min-w-[11rem] max-w-xs flex-1 rounded-[2px] border bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
      }
    >
      {label ? (
        <p className="text-[var(--star-text-muted)] mb-1.5 text-[10px] font-bold tracking-wide uppercase">
          {label}
        </p>
      ) : null}
      <p className="text-star-blue font-mono text-[11px] font-semibold">{ticket.ticket_number}</p>
      <p className="text-star-navy mt-1 line-clamp-2 text-sm font-semibold leading-snug">
        {ticket.title}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="ledger-status-pill text-[10px]">
          <span className="bg-star-navy size-1.5 shrink-0 rounded-full" aria-hidden />
          {statusLabel(ticket.status)}
        </span>
        <Badge variant="outline" className="border-star-blue/40 text-[10px]">
          {priorityLabel(ticket.priority)}
        </Badge>
        {ticket.is_major ? (
          <Badge variant="destructive" className="text-[10px]">
            Stor sag
          </Badge>
        ) : null}
      </div>
    </Link>
  );
}

function NodeCluster({ title, tickets }: { title: string; tickets: TicketSummary[] }) {
  if (tickets.length === 0) {
    return null;
  }
  return (
    <section className="space-y-3">
      <h3 className="wire-card-title text-center">{title}</h3>
      <div className="flex flex-wrap justify-center gap-3">
        {tickets.map((item) => (
          <OverviewNode key={item.id} ticket={item} />
        ))}
      </div>
    </section>
  );
}

export function TicketConnectionOverview({ ticket }: { ticket: TicketDetail }) {
  const parent = ticket.parent ?? null;
  const children = ticket.children ?? [];
  const related = ticket.related_major_tickets ?? [];
  const isStoreSag = ticket.is_major && !ticket.parent_ticket_id;
  const connectionCount = (parent ? 1 : 0) + children.length + related.length;

  return (
    <article className="wire-scroll-content space-y-4">
      <Link
        href={`/tickets/${ticket.id}`}
        className="text-[var(--gray-mid)] hover:text-star-navy inline-flex items-center gap-1 text-xs font-medium"
      >
        ← Tilbage til sag
      </Link>

      <header className="wire-card mb-0">
        <p className="wire-card-title mb-0">Stor sag – oversigt</p>
        <h1 className="text-star-navy mt-2 text-xl font-bold tracking-tight md:text-2xl">
          Tilknyttede sager
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          Visuelt overblik over hierarki og relationer for{" "}
          <span className="text-star-navy font-mono font-semibold">{ticket.ticket_number}</span>
          {connectionCount > 0 ? (
            <>
              {" "}
              — {connectionCount} tilknytning{connectionCount === 1 ? "" : "er"}
            </>
          ) : (
            " — ingen andre sager knyttet endnu"
          )}
        </p>
        {isStoreSag ? (
          <Badge variant="destructive" className="mt-3">
            Stor sag
          </Badge>
        ) : null}
      </header>

      <div className="wire-card">
        <div className="mx-auto flex max-w-4xl flex-col items-stretch gap-1 py-2">
          {parent ? (
            <>
              <NodeCluster title="Overordnet sag" tickets={[parent]} />
              <Connector />
            </>
          ) : null}

          {related.length > 0 ? (
            <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center lg:justify-center">
              <div className="flex flex-1 flex-wrap justify-center gap-3 lg:justify-end">
                {related.slice(0, Math.ceil(related.length / 2)).map((item) => (
                  <OverviewNode key={item.id} ticket={item} label="Relateret stor sag" />
                ))}
              </div>
              <div className="flex shrink-0 justify-center px-2">
                <OverviewNode ticket={ticket} emphasis label="Denne sag" />
              </div>
              <div className="flex flex-1 flex-wrap justify-center gap-3 lg:justify-start">
                {related.slice(Math.ceil(related.length / 2)).map((item) => (
                  <OverviewNode key={item.id} ticket={item} label="Relateret stor sag" />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <OverviewNode ticket={ticket} emphasis label="Denne sag" />
            </div>
          )}

          {children.length > 0 ? (
            <>
              <Connector />
              <NodeCluster title="Undersager" tickets={children} />
            </>
          ) : isStoreSag ? (
            <>
              <Connector />
              <p className="text-muted-foreground text-center text-sm">
                Ingen undersager knyttet til denne store sag endnu.
              </p>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href={`/tickets/${ticket.id}`}
          className="border-star-navy text-star-navy hover:bg-star-navy inline-flex items-center rounded-[2px] border px-3 py-1.5 font-medium transition-colors hover:text-white"
        >
          Åbn sagdetaljer
        </Link>
        <Link
          href="/tickets/major"
          className="text-star-blue hover:text-star-navy font-medium underline-offset-2 hover:underline"
        >
          Alle store sager
        </Link>
      </div>
    </article>
  );
}
