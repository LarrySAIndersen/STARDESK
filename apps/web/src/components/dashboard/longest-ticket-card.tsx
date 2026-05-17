import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { priorityLabel } from "@/lib/ticket-labels";
import type { LongestOpenTicket } from "@/types/dashboard";

function formatDuration(days: number, hours: number): string {
  if (days >= 1) {
    return `${days.toLocaleString("da-DK", { maximumFractionDigits: 1 })} dage`;
  }
  return `${Math.round(hours)} timer`;
}

export function LongestTicketCard({ ticket }: { ticket: LongestOpenTicket | null }) {
  if (!ticket) {
    return (
      <section
        className="star-section-card border-star-blue border-l-4 p-6"
        aria-labelledby="longest-ticket-heading"
      >
        <h2 id="longest-ticket-heading" className="text-star-navy text-lg font-bold">
          Længste åbne sag
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">Ingen åbne sager lige nu.</p>
      </section>
    );
  }

  return (
    <section
      className="star-section-card border-star-red relative overflow-hidden border-l-4 p-6"
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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant="destructive" className="text-sm">
          {formatDuration(ticket.days_open, ticket.hours_open)}
        </Badge>
        <Badge variant="outline">{ticket.status_label_da}</Badge>
        <Badge>{priorityLabel(ticket.priority)}</Badge>
        {ticket.assigned_team_name ? (
          <Badge variant="secondary">{ticket.assigned_team_name}</Badge>
        ) : null}
      </div>

      <p className="text-muted-foreground mt-4 text-xs">
        Oprettet{" "}
        {new Intl.DateTimeFormat("da-DK", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(ticket.created_at))}
      </p>

      <Link
        href={`/tickets/${ticket.id}`}
        className="text-star-blue mt-4 inline-block text-sm font-semibold hover:underline"
      >
        Gå til sagen →
      </Link>
    </section>
  );
}
