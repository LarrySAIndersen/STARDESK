"use client";

import { TeamGroupTicketRow } from "@/components/dispatch/team-group-ticket-row";
import { TEAM_GROUP_PREVIEW_LIMIT } from "@/lib/team-group-view";
import { cn } from "@/lib/utils";
import type { Ticket } from "@/types/ticket";

/** Scrollable ticket list under a group column (preview or all when selected). */
export function TeamGroupTicketList({
  tickets,
  total,
  isSelected,
  previewLimit = TEAM_GROUP_PREVIEW_LIMIT,
  ticketHref,
  onTicketClick,
  emptyLabel = "Ingen tildelte sager",
  draggableTickets = false,
}: {
  tickets: Ticket[];
  total: number;
  isSelected: boolean;
  showingAll: boolean;
  previewLimit?: number;
  ticketHref?: (ticketId: string) => string;
  /** Opens inline sagens kort when set (takes precedence over navigation). */
  onTicketClick?: (ticket: Ticket) => void;
  emptyLabel?: string;
  draggableTickets?: boolean;
}) {
  if (tickets.length === 0) {
    return <p className="text-[10px] text-[var(--gray-mid)]">{emptyLabel}</p>;
  }

  return (
    <>
      {isSelected && total > 0 ? (
        <p className="text-muted-foreground mb-1 text-[9px] font-semibold">
          Klik en sag for sagens kort — {total} i alt
        </p>
      ) : null}
      <ul
        className={cn(
          "space-y-1 border-t border-[var(--gray-border)] pt-1.5",
          isSelected && total > previewLimit && "max-h-96 overflow-y-auto pr-0.5",
        )}
      >
        {tickets.map((ticket) => (
          <li key={ticket.id}>
            <TeamGroupTicketRow
              ticket={ticket}
              onOpen={
                onTicketClick ? () => onTicketClick(ticket) : undefined
              }
              href={onTicketClick ? undefined : ticketHref?.(ticket.id)}
              size="sm"
              draggable={draggableTickets}
            />
          </li>
        ))}
      </ul>
      {!isSelected && total > previewLimit ? (
        <p className="text-muted-foreground mt-1 text-[9px]">
          Klik gruppen for alle {total} sager
        </p>
      ) : null}
    </>
  );
}
