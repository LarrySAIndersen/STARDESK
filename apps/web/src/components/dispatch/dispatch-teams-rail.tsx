"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { Ticket } from "@/types/ticket";
import type { Team } from "@/types/team";

/** Nyeste sager vist per gruppe i rail — badge viser samlet antal. */
export const TEAM_RAIL_TICKET_PREVIEW = 5;

export function DispatchTeamsRail({
  teams,
  ticketsByTeam,
  dragOverTeamId,
  onDragOverTeam,
  onDragLeaveTeam,
  onDropTeam,
  title = "Grupper",
  description = "Slip en sag her for at tildele",
  sectionLabel = "Interne grupper",
  previewLimit,
}: {
  teams: Team[];
  ticketsByTeam: Map<string, Ticket[]>;
  dragOverTeamId: string | null;
  onDragOverTeam: (teamId: string, event: React.DragEvent) => void;
  onDragLeaveTeam: () => void;
  onDropTeam: (team: Team, event: React.DragEvent) => void;
  title?: string;
  description?: string;
  sectionLabel?: string;
  previewLimit?: number;
}) {
  const limit = previewLimit ?? TEAM_RAIL_TICKET_PREVIEW;

  return (
    <aside className="flex min-h-0 flex-col space-y-3 overflow-y-auto" aria-labelledby="dispatch-groups-heading">
      <div className="star-section-header shrink-0 rounded-t-md">
        <p className="text-muted-foreground mb-1 text-[10px] font-bold tracking-widest uppercase">
          {sectionLabel}
        </p>
        <h2 id="dispatch-groups-heading" className="star-section-title">
          {title}
        </h2>
        <p className="star-section-desc">{description}</p>
      </div>
      {teams.map((team) => {
        const allTeamTickets = ticketsByTeam.get(team.id) ?? [];
        const totalCount = allTeamTickets.length;
        const teamTickets = allTeamTickets.slice(0, limit);
        const isOver = dragOverTeamId === team.id;
        return (
          <div
            key={team.id}
            role="group"
            aria-label={`${team.name}, slip sag her`}
            onDragOver={(event) => onDragOverTeam(team.id, event)}
            onDragLeave={onDragLeaveTeam}
            onDrop={(event) => onDropTeam(team, event)}
            className={`rounded-md border-2 border-dashed p-4 transition-colors ${
              isOver
                ? "border-star-blue bg-star-blue-light"
                : "border-star-blue/30 bg-white"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-star-navy font-semibold">{team.name}</p>
                {team.name === "SF" ? (
                  <p className="text-star-navy text-xs font-medium uppercase">Hovedgruppe</p>
                ) : null}
              </div>
              <Badge variant="outline">
                {totalCount} sag{totalCount === 1 ? "" : "er"}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">{team.members.length} medlemmer</p>
            {totalCount > 0 ? (
              <>
                <ul className="mt-3 space-y-1.5 border-t border-star-blue/15 pt-3">
                  {teamTickets.map((ticket) => (
                    <li key={ticket.id}>
                      <Link
                        href={`/tickets/${ticket.id}`}
                        className="text-star-blue hover:text-star-navy block text-xs leading-snug font-medium hover:underline"
                        draggable={false}
                      >
                        <span className="font-mono">{ticket.ticket_number}</span>
                        <span className="text-foreground ml-1 font-normal">{ticket.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {totalCount > limit ? (
                  <p className="text-muted-foreground mt-2 text-[11px]">
                    Viser {limit} nyeste af {totalCount}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground mt-2 text-xs">Ingen tildelte sager</p>
            )}
          </div>
        );
      })}
    </aside>
  );
}
