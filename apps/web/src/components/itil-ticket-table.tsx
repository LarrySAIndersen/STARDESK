import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SlaCountdown } from "@/components/sla-countdown";
import { TicketTagBadges } from "@/components/ticket-tag-badges";
import { priorityLabel, statusLabel, ticketTypeLabel } from "@/lib/ticket-labels";
import type { Ticket } from "@/types/ticket";

function formatDate(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

function priorityVariant(
  priority: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (priority === "critical" || priority === "high") {
    return "destructive";
  }
  if (priority === "medium") {
    return "default";
  }
  return "secondary";
}

function subCauseSummary(ticket: Ticket): string {
  const causes = ticket.sub_causes ?? [];
  if (causes.length === 0) {
    return "—";
  }
  return causes.map((sc) => sc.name_da).join(", ");
}

export function ItilTicketTable({
  tickets,
  compact = false,
}: {
  tickets: Ticket[];
  compact?: boolean;
}) {
  if (tickets.length === 0) {
    return <p className="text-muted-foreground text-sm">Ingen sager at vise.</p>;
  }

  return (
    <div className="star-table-wrap">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sagsnr.</TableHead>
            <TableHead>Kort beskrivelse</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Prioritet</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Kategori</TableHead>
            <TableHead>Tildelt gruppe</TableHead>
            <TableHead>Sagsbehandler</TableHead>
            <TableHead>Indmelder</TableHead>
            {!compact ? <TableHead>Underårsager</TableHead> : null}
            <TableHead>Oprettet</TableHead>
            <TableHead>Opdateret</TableHead>
            <TableHead>SLA</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((ticket) => (
            <TableRow
              key={ticket.id}
              data-major={ticket.is_major ? "true" : undefined}
            >
              <TableCell className="font-mono text-xs whitespace-nowrap">
                <Link
                  href={`/tickets/${ticket.id}`}
                  className="font-semibold text-star-blue hover:text-star-navy"
                >
                  {ticket.ticket_number}
                </Link>
                {ticket.is_major && !ticket.parent_ticket_id ? (
                  <Badge variant="destructive" className="ml-1" aria-label="Stor sag">
                    Stor
                  </Badge>
                ) : null}
                {ticket.parent_ticket_id ? (
                  <Badge variant="secondary" className="ml-1" aria-label="Små sag">
                    Små
                  </Badge>
                ) : null}
                {(ticket.child_count ?? 0) > 0 ? (
                  <Badge variant="outline" className="ml-1" aria-label="Har små sager">
                    {ticket.child_count}
                  </Badge>
                ) : null}
                {ticket.is_security_ticket ? (
                  <Badge variant="outline" className="ml-1 border-amber-600 text-amber-800" aria-label="Sikkerhedssag">
                    Sikkerhed
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell className="max-w-[14rem] truncate">
                <Link
                  href={`/tickets/${ticket.id}`}
                  className="text-star-navy hover:text-star-blue inline-flex items-center gap-1 font-medium"
                >
                  {ticket.emoji ? (
                    <span className="text-base" aria-hidden>
                      {ticket.emoji}
                    </span>
                  ) : null}
                  {ticket.title}
                </Link>
              </TableCell>
              <TableCell className="max-w-[8rem]">
                <TicketTagBadges tags={ticket.tags} emoji={null} maxTags={2} />
              </TableCell>
              <TableCell>
                <Badge variant="outline">{statusLabel(ticket.status)}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={priorityVariant(ticket.priority)}>
                  {priorityLabel(ticket.priority)}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">{ticketTypeLabel(ticket.ticket_type)}</TableCell>
              <TableCell className="text-muted-foreground max-w-[8rem] truncate text-xs">
                {ticket.category_name_da ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground max-w-[8rem] truncate text-xs">
                {ticket.assigned_team_name ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground max-w-[8rem] truncate text-xs">
                {ticket.assigned_user_name ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground max-w-[8rem] truncate text-xs">
                {ticket.reporter_display_name ?? "—"}
              </TableCell>
              {!compact ? (
                <TableCell className="text-muted-foreground max-w-[10rem] truncate text-xs">
                  {subCauseSummary(ticket)}
                </TableCell>
              ) : null}
              <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                {formatDate(ticket.created_at)}
              </TableCell>
              <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                {formatDate(ticket.updated_at)}
              </TableCell>
              <TableCell>
                <SlaCountdown
                  status={ticket.status}
                  resolutionDueAt={ticket.resolution_due_at}
                  slaRemainingSeconds={ticket.sla_remaining_seconds}
                  slaBreached={ticket.sla_breached}
                  compact
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
