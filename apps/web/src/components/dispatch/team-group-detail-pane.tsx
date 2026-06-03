"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import type { Team } from "@/types/team";
import type { Ticket } from "@/types/ticket";

/** Full scrollable list of all tickets in a group (agent panel, large groups). */
export function TeamGroupDetailPane({
  team,
  tickets,
  onClose,
  onTicketClick,
  ticketHref,
  className,
}: {
  team: Team;
  tickets: Ticket[];
  onClose: () => void;
  onTicketClick?: (ticket: Ticket) => void;
  ticketHref?: (ticketId: string) => string;
  className?: string;
}) {
  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col border-b border-[var(--gray-border)]", className)}
      role="region"
      aria-label={`Alle sager i ${team.name}`}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0">
          <p className="text-star-navy text-xs font-bold">{team.name}</p>
          <p className="text-muted-foreground text-[11px]">
            {tickets.length} åben{tickets.length === 1 ? "" : "e"} sag
            {tickets.length === 1 ? "" : "er"} i gruppen
          </p>
        </div>
        <button
          type="button"
          className="text-muted-foreground hover:text-star-navy shrink-0 text-[11px] font-semibold"
          onClick={onClose}
        >
          Luk liste
        </button>
      </div>
      {tickets.length === 0 ? (
        <p className="text-muted-foreground px-3 pb-3 text-sm">Ingen åbne sager i denne gruppe.</p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="border-b border-[var(--gray-border)]/60 last:border-0">
              {ticketHref ? (
                <Link
                  href={ticketHref(ticket.id)}
                  className="hover:bg-star-blue-light/40 block rounded-[2px] py-1.5 text-left"
                  title={`${ticket.ticket_number} ${ticket.title}`}
                >
                  <TicketRow ticket={ticket} />
                </Link>
              ) : (
                <button
                  type="button"
                  className="hover:bg-star-blue-light/40 w-full rounded-[2px] py-1.5 text-left"
                  title={`${ticket.ticket_number} ${ticket.title}`}
                  onClick={() => onTicketClick?.(ticket)}
                >
                  <TicketRow ticket={ticket} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TicketRow({ ticket }: { ticket: Ticket }) {
  return (
    <>
      <span className="text-star-navy font-mono text-[11px] font-semibold">
        {ticket.ticket_number}
      </span>
      <span className="text-foreground ml-2 text-[11px]">{ticket.title}</span>
    </>
  );
}
