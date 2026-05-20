"use client";

import { useRouter } from "next/navigation";

import { WirePriorityBadge, WireStatusBadge } from "@/components/wireframe/wire-badge";
import { WireTags } from "@/components/wireframe/wire-tags";
import { SlaCountdown } from "@/components/sla-countdown";
import { cn } from "@/lib/utils";
import { ticketSourceLabelDa } from "@/lib/ticket-source-label";
import type { Ticket } from "@/types/ticket";

import { TICKET_DRAG_TYPE, setTicketDragData } from "@/lib/ticket-drag";

export function WireframeTicketTable({
  tickets,
  draggable = false,
  onRowClick,
  onDragStart,
  className,
}: {
  tickets: Ticket[];
  draggable?: boolean;
  onRowClick?: (ticket: Ticket) => void;
  onDragStart?: (ticket: Ticket, event: React.DragEvent) => void;
  className?: string;
}) {
  const router = useRouter();

  if (tickets.length === 0) {
    return <p className="text-[var(--gray-mid)] text-sm">Ingen sager at vise.</p>;
  }

  return (
    <div className={cn("wire-table-wrap", className)}>
      <div className="wire-table-scroll wire-table-scroll--tickets">
      <div
        className="wire-table-head wire-table-grid-tickets"
        role="row"
      >
        <span>Sagsnr</span>
        <span>Titel og tags</span>
        <span>Kilde</span>
        <span>Kategori</span>
        <span>Status</span>
        <span>Prioritet</span>
        <span>SLA</span>
      </div>
      {tickets.map((ticket) => (
        <div
          key={ticket.id}
          role="row"
          className={cn(
            "wire-table-row wire-table-grid-tickets",
            draggable && "cursor-grab active:cursor-grabbing",
          )}
          draggable={draggable}
          onDragStart={(e) => {
            setTicketDragData(e, ticket.id);
            onDragStart?.(ticket, e);
          }}
          onClick={() => {
            if (onRowClick) {
              onRowClick(ticket);
            } else {
              router.push(`/tickets/${ticket.id}`);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              router.push(`/tickets/${ticket.id}`);
            }
          }}
        >
          <span className="text-[var(--gray-mid)] text-xs font-semibold">
            {ticket.ticket_number}
          </span>
          <span className="min-w-0">
            <p className="truncate text-[13px] font-medium">{ticket.title}</p>
            <WireTags tags={ticket.tags} />
          </span>
          <span className="truncate text-[11px] font-semibold text-star-navy">
            {ticket.source_label_da ?? ticketSourceLabelDa(ticket.source)}
          </span>
          <span className="truncate text-xs">
            {ticket.category_name_da ?? "—"}
          </span>
          <span>
            <WireStatusBadge status={ticket.status} />
          </span>
          <span>
            <WirePriorityBadge priority={ticket.priority} />
          </span>
          <span>
            <SlaCountdown
              status={ticket.status}
              resolutionDueAt={ticket.resolution_due_at}
              slaRemainingSeconds={ticket.sla_remaining_seconds}
              slaBreached={ticket.sla_breached}
              compact
              className="text-[11px]"
            />
          </span>
        </div>
      ))}
      </div>
    </div>
  );
}

export { TICKET_DRAG_TYPE as DRAG_TYPE };
