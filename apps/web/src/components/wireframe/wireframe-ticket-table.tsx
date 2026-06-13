"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { WirePriorityBadge, WireStatusBadge } from "@/components/wireframe/wire-badge";
import { WireTags } from "@/components/wireframe/wire-tags";
import { SlaCountdown } from "@/components/sla-countdown";
import { cn } from "@/lib/utils";
import { ticketSourceLabelDa } from "@/lib/ticket-source-label";
import type { Ticket } from "@/types/ticket";

import { TicketPostItBadge } from "@/components/personal/ticket-post-it-badge";
import { TicketPostItDropTarget } from "@/components/personal/post-it-attach-provider";
import { TicketQuickInviteButton } from "@/components/ticket/ticket-quick-invite-button";
import { TicketWatchEye } from "@/components/tickets/ticket-watch-eye";
import type { Team } from "@/types/team";
import { TICKET_DRAG_TYPE, setTicketDragData } from "@/lib/ticket-drag";

export function WireframeTicketTable({
  tickets,
  draggable = false,
  showTeamColumn = false,
  onRowClick,
  onDragStart,
  onDragEnd,
  className,
  columnFilters,
  postItCounts,
  postItDropEnabled = false,
  showWatchColumn = false,
  watchingById,
  onToggleWatch,
  showInviteColumn = false,
  inviteTeams = [],
}: {
  tickets: Ticket[];
  draggable?: boolean;
  postItCounts?: Record<string, number>;
  postItDropEnabled?: boolean;
  showWatchColumn?: boolean;
  watchingById?: Record<string, boolean>;
  onToggleWatch?: (ticketId: string) => void;
  showInviteColumn?: boolean;
  inviteTeams?: Team[];
  /** Service desk: show assigned group on each row. */
  showTeamColumn?: boolean;
  onRowClick?: (ticket: Ticket) => void;
  onDragStart?: (ticket: Ticket, event: React.DragEvent) => void;
  onDragEnd?: (ticket: Ticket) => void;
  className?: string;
  /** Replaces static column headers (e.g. filter/sort row). */
  columnFilters?: ReactNode;
}) {
  const gridClass = cn(
    showTeamColumn ? "wire-table-grid-tickets-desk" : "wire-table-grid-tickets",
    showWatchColumn && "wire-table-grid-tickets--watch",
    showInviteColumn && "wire-table-grid-tickets--invite",
  );
  const router = useRouter();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const didDragRef = useRef(false);

  if (tickets.length === 0) {
    return <p className="text-[var(--gray-mid)] text-sm">Ingen sager at vise.</p>;
  }

  return (
    <div className={cn("wire-table-wrap", className)}>
      <div className="wire-table-scroll wire-table-scroll--tickets">
      {columnFilters ?? (
        <div className={cn("wire-table-head", gridClass)} role="row">
          {showWatchColumn ? <span aria-hidden /> : null}
          {showInviteColumn ? <span aria-hidden /> : null}
          <span>Sagsnr</span>
          <span>Titel og tags</span>
          <span>Kilde</span>
          <span>Kategori</span>
          <span>Status</span>
          <span>Prioritet</span>
          {showTeamColumn ? <span>Gruppe</span> : null}
          <span>SLA</span>
        </div>
      )}
      {tickets.map((ticket) => {
        const row = (
        <div
          role="row"
          className={cn(
            "wire-table-row",
            gridClass,
            draggable && "cursor-grab active:cursor-grabbing",
            draggingId === ticket.id && "wire-table-row--dragging",
          )}
          draggable={draggable}
          onDragStart={(e) => {
            didDragRef.current = true;
            setDraggingId(ticket.id);
            setTicketDragData(e, ticket.id);
            onDragStart?.(ticket, e);
          }}
          onDragEnd={() => {
            setDraggingId(null);
            onDragEnd?.(ticket);
            window.setTimeout(() => {
              didDragRef.current = false;
            }, 0);
          }}
          onClick={() => {
            if (didDragRef.current) {
              return;
            }
            if (onRowClick) {
              onRowClick(ticket);
            } else {
              router.push(`/tickets/${ticket.id}`);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !didDragRef.current) {
              if (onRowClick) {
                onRowClick(ticket);
              } else {
                router.push(`/tickets/${ticket.id}`);
              }
            }
          }}
        >
          {showWatchColumn ? (
            <span className="flex items-center justify-center">
              <TicketWatchEye
                watching={watchingById?.[ticket.id] ?? false}
                onToggle={() => onToggleWatch?.(ticket.id)}
                compact
              />
            </span>
          ) : null}
          {showInviteColumn && inviteTeams.length > 0 ? (
            <span className="flex items-center justify-center">
              <TicketQuickInviteButton ticketId={ticket.id} teams={inviteTeams} />
            </span>
          ) : null}
          <span className="text-[var(--gray-mid)] flex items-center gap-1 text-xs font-semibold">
            {ticket.ticket_number}
            <TicketPostItBadge count={postItCounts?.[ticket.id] ?? 0} />
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
          {showTeamColumn ? (
            <span className="truncate text-[11px] font-semibold text-star-navy">
              {ticket.assigned_team_name ?? "—"}
            </span>
          ) : null}
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
        );

        if (!postItDropEnabled) {
          return <div key={ticket.id}>{row}</div>;
        }

        return (
          <TicketPostItDropTarget
            key={ticket.id}
            ticketId={ticket.id}
            ticketNumber={ticket.ticket_number}
            ticketTitle={ticket.title}
          >
            {row}
          </TicketPostItDropTarget>
        );
      })}
    </div>
    </div>
  );
}

export { TICKET_DRAG_TYPE as DRAG_TYPE };
