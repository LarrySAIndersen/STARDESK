"use client";

import Link from "next/link";

import { TEAM_GROUP_PREVIEW_LIMIT } from "@/lib/team-group-view";
import { cn } from "@/lib/utils";
import type { Ticket } from "@/types/ticket";

/** Scrollable ticket list under a group column (preview or all when selected). */
export function TeamGroupTicketList({
  tickets,
  total,
  isSelected,
  showingAll: _showingAll,
  previewLimit = TEAM_GROUP_PREVIEW_LIMIT,
  ticketHref,
  onTicketClick,
  emptyLabel = "Ingen tildelte sager",
}: {
  tickets: Ticket[];
  total: number;
  isSelected: boolean;
  showingAll: boolean;
  previewLimit?: number;
  ticketHref?: (ticketId: string) => string;
  onTicketClick?: (ticket: Ticket) => void;
  emptyLabel?: string;
}) {
  if (tickets.length === 0) {
    return <p className="text-[10px] text-[var(--gray-mid)]">{emptyLabel}</p>;
  }

  return (
    <>
      {isSelected && total > 0 ? (
        <p className="text-muted-foreground mb-1 text-[9px] font-semibold">
          Viser alle {total} sager
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
            {ticketHref ? (
              <Link
                href={ticketHref(ticket.id)}
                className="block truncate rounded-[2px] px-1 py-0.5 text-[10px] font-medium text-star-navy hover:bg-star-blue-light/40"
                title={`${ticket.ticket_number} ${ticket.title}`}
                draggable={false}
              >
                <span className="font-mono">{ticket.ticket_number}</span>
                <span className="text-muted-foreground ml-1 font-normal">{ticket.title}</span>
              </Link>
            ) : onTicketClick ? (
              <button
                type="button"
                className="w-full truncate rounded-[2px] px-1 py-0.5 text-left text-[10px] font-medium text-star-navy hover:bg-star-blue-light/40"
                title={`${ticket.ticket_number} ${ticket.title}`}
                onClick={() => onTicketClick(ticket)}
              >
                <span className="font-mono">{ticket.ticket_number}</span>
                <span className="text-muted-foreground ml-1 font-normal">{ticket.title}</span>
              </button>
            ) : (
              <span
                className="block truncate px-1 py-0.5 text-[10px] font-medium text-star-navy"
                title={`${ticket.ticket_number} ${ticket.title}`}
              >
                <span className="font-mono">{ticket.ticket_number}</span>
                <span className="text-muted-foreground ml-1 font-normal">{ticket.title}</span>
              </span>
            )}
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
