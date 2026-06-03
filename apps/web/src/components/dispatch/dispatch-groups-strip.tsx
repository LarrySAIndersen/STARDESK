"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import type { Team } from "@/types/team";
import type { Ticket } from "@/types/ticket";

export const GROUPS_STRIP_TICKET_PREVIEW = 6;

export function DispatchGroupsStrip({
  teams,
  ticketsByTeam,
  dragOverTeamId,
  onDragOverTeam,
  onDragLeaveTeam,
  onDropTeam,
  selectedTeamId = null,
  onSelectTeam,
  ticketHref,
  className,
}: {
  teams: Team[];
  ticketsByTeam: Map<string, Ticket[]>;
  dragOverTeamId: string | null;
  onDragOverTeam: (teamId: string, event: React.DragEvent) => void;
  onDragLeaveTeam: () => void;
  onDropTeam: (team: Team, event: React.DragEvent) => void;
  selectedTeamId?: string | null;
  onSelectTeam?: (teamId: string | null) => void;
  /** When set, ticket rows link to detail instead of button-only. */
  ticketHref?: (ticketId: string) => string;
  className?: string;
}) {
  return (
    <div
      className={cn("flex overflow-x-auto pb-1", className)}
      role="region"
      aria-label="Gruppefordeling"
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onDragLeaveTeam();
        }
      }}
    >
      {teams.map((team) => {
        const isSelected = selectedTeamId === team.id;
        const isHover = dragOverTeamId === team.id;
        const teamTicketList = ticketsByTeam.get(team.id) ?? [];
        const totalTeamTickets = teamTicketList.length;
        const teamTickets = teamTicketList.slice(0, GROUPS_STRIP_TICKET_PREVIEW);

        return (
          <div
            key={team.id}
            className={cn(
              "mr-3 w-[200px] shrink-0 rounded-[2px] transition-all",
              isSelected && "ring-2 ring-star-navy/30",
            )}
          >
            <button
              type="button"
              onClick={() => onSelectTeam?.(isSelected ? null : team.id)}
              disabled={!onSelectTeam}
              className={cn(
                "mb-1.5 flex w-full items-center justify-between rounded-[2px] px-2 py-1.5 text-left text-[11px] font-bold transition-colors",
                isSelected
                  ? "bg-star-navy text-white"
                  : "bg-star-blue-light text-star-navy hover:bg-star-blue-light/80",
              )}
              aria-pressed={isSelected}
            >
              <span className="truncate">{team.name}</span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 text-[9px]",
                  isSelected ? "bg-white/20 text-white" : "bg-star-navy text-white",
                )}
              >
                {totalTeamTickets}
              </span>
            </button>

            <div
              data-team-drop-id={team.id}
              onDragOver={(event) => onDragOverTeam(team.id, event)}
              onDrop={(event) => onDropTeam(team, event)}
              className={cn(
                "wire-bereder-streg relative mb-2 flex min-h-[2.25rem] items-center justify-center rounded-[2px] border-2 border-dashed px-2 py-1.5 text-center text-[10px] font-semibold transition-all",
                isHover
                  ? "border-[#1A7A44] bg-[#E6F5EC] text-[#1A7A44] ring-2 ring-[#1A7A44]/25"
                  : "border-[var(--gray-border)] bg-[var(--gray-bg)] text-[var(--gray-mid)]",
              )}
              aria-label={`Slip sag på ${team.name}`}
            >
              {isHover ? "Slip her" : "Træk sag hertil"}
            </div>

            {teamTickets.length > 0 ? (
              <ul className="space-y-1 border-t border-[var(--gray-border)] pt-1.5">
                {teamTickets.map((ticket) => (
                  <li key={ticket.id}>
                    {ticketHref ? (
                      <Link
                        href={ticketHref(ticket.id)}
                        className="block truncate rounded-[2px] px-1 py-0.5 text-[10px] font-medium text-star-navy hover:bg-star-blue-light/40"
                        title={`${ticket.ticket_number} ${ticket.title}`}
                        draggable={false}
                      >
                        <span className="font-mono">{ticket.ticket_number}</span>
                        <span className="text-muted-foreground ml-1 font-normal">
                          {ticket.title}
                        </span>
                      </Link>
                    ) : (
                      <span
                        className="block truncate px-1 py-0.5 text-[10px] font-medium text-star-navy"
                        title={`${ticket.ticket_number} ${ticket.title}`}
                      >
                        <span className="font-mono">{ticket.ticket_number}</span>
                        <span className="text-muted-foreground ml-1 font-normal">
                          {ticket.title}
                        </span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[10px] text-[var(--gray-mid)]">Ingen tildelte sager</p>
            )}
            <p className="mt-1.5 text-[9px] text-[var(--gray-mid)]">
              {team.members.length} medlemmer
            </p>
          </div>
        );
      })}
    </div>
  );
}
