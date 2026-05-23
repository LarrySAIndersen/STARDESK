import Link from "next/link";

import { LongestTicketSla } from "@/components/dashboard/longest-ticket-sla";
import { Badge } from "@/components/ui/badge";
import { priorityLabel } from "@/lib/ticket-labels";
import type { LongestOpenTicket } from "@/types/dashboard";

function formatDuration(days: number, hours: number): string {
  if (days >= 1) {
    return `${days.toLocaleString("da-DK", { maximumFractionDigits: 1 })} dage`;
  }
  return `${Math.round(hours)} timer`;
}

function hasSlaDisplay(ticket: LongestOpenTicket): boolean {
  return (
    ticket.sla_breached === true ||
    ticket.sla_remaining_seconds != null ||
    ticket.resolution_due_at != null
  );
}

export function LongestTicketCard({ ticket }: { ticket: LongestOpenTicket | null }) {
  if (!ticket) {
    return (
      <section
        className="star-section-card border-star-blue border-l-4 p-8"
        aria-labelledby="longest-ticket-heading"
      >
        <h2 id="longest-ticket-heading" className="text-star-navy text-lg font-bold">
          Længste åbne sag
        </h2>
        <p className="text-muted-foreground mt-3 text-sm">Ingen åbne sager lige nu.</p>
      </section>
    );
  }

  const showSla = hasSlaDisplay(ticket);

  return (
    <section
      className="star-section-card border-star-red relative overflow-hidden border-l-4 p-8"
      aria-labelledby="longest-ticket-heading"
    >
      <div
        className="pointer-events-none absolute -top-8 -right-8 size-32 rounded-full bg-star-red/10"
        aria-hidden
      />
      <p className="text-star-red text-xs font-semibold tracking-wide uppercase">
        Længste åbne sag
      </p>
      <h2 id="longest-ticket-heading" className="text-star-navy mt-2 text-2xl font-bold">
        <Link href={`/tickets/${ticket.id}`} className="hover:underline">
          {ticket.ticket_number}
        </Link>
      </h2>
      <p className="text-star-navy mt-1 line-clamp-2 text-base font-medium">{ticket.title}</p>

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <Badge variant="destructive" className="text-sm">
          {formatDuration(ticket.days_open, ticket.hours_open)}
        </Badge>
        <Badge variant="outline">{ticket.status_label_da}</Badge>
        <Badge>{priorityLabel(ticket.priority)}</Badge>
        {ticket.assigned_team_name ? (
          <Badge variant="secondary">{ticket.assigned_team_name}</Badge>
        ) : null}
      </div>

      <dl className="text-muted-foreground mt-5 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold tracking-wide uppercase">Tildelt</dt>
          <dd className="text-star-navy mt-0.5 font-medium">
            {ticket.assigned_user_name ?? "Ikke tildelt"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold tracking-wide uppercase">Team</dt>
          <dd className="text-star-navy mt-0.5 font-medium">
            {ticket.assigned_team_name ?? "—"}
          </dd>
        </div>
        {showSla ? (
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold tracking-wide uppercase">SLA</dt>
            <dd className="mt-0.5">
              <LongestTicketSla ticket={ticket} />
            </dd>
          </div>
        ) : null}
      </dl>

      <p className="text-muted-foreground mt-4 text-xs">
        Oprettet{" "}
        {new Intl.DateTimeFormat("da-DK", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(ticket.created_at))}
      </p>

      <Link
        href={`/tickets/${ticket.id}`}
        className="text-star-blue mt-5 inline-block text-sm font-semibold hover:underline"
      >
        Gå til sagen →
      </Link>
    </section>
  );
}
