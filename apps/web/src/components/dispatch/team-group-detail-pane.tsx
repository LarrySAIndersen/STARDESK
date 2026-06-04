"use client";

import Link from "next/link";

import { TeamGroupTicketRow } from "@/components/dispatch/team-group-ticket-row";
import { ClickableMetric } from "@/components/dashboard/clickable-metric";
import { buildTicketsFilterHref } from "@/lib/dashboard-ticket-links";
import { ticketDetailHref } from "@/lib/team-group-view";
import { cn } from "@/lib/utils";
import type { Team } from "@/types/team";
import type { Ticket } from "@/types/ticket";

/** Full scrollable list of all tickets in a group (agent panel, large groups). */
export function TeamGroupDetailPane({
  team,
  tickets,
  onClose,
  onTicketClick,
  className,
}: {
  team: Team;
  tickets: Ticket[];
  onClose: () => void;
  onTicketClick?: (ticket: Ticket) => void;
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
            <ClickableMetric
              href={
                tickets.length > 0
                  ? buildTicketsFilterHref({
                      scope: "all",
                      assignedTeamId: team.id,
                      openOnly: true,
                    })
                  : undefined
              }
              inline
              ariaLabel={`${team.name}: ${tickets.length} åbne sager`}
            >
              {tickets.length} åben{tickets.length === 1 ? "" : "e"} sag
              {tickets.length === 1 ? "" : "er"}
            </ClickableMetric>{" "}
            — klik en sag for sagens kort
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
              <TeamGroupTicketRow
                ticket={ticket}
                onOpen={onTicketClick ? () => onTicketClick(ticket) : undefined}
                href={onTicketClick ? undefined : ticketDetailHref(ticket.id)}
                size="md"
              />
              {onTicketClick ? (
                <Link
                  href={ticketDetailHref(ticket.id)}
                  className="text-star-blue mt-0.5 ml-1 inline-block text-[10px] font-semibold hover:underline"
                >
                  Åbn fuld sag →
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
