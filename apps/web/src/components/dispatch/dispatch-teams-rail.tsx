"use client";

import { TeamGroupTicketList } from "@/components/dispatch/team-group-ticket-list";
import { Badge } from "@/components/ui/badge";
import {
  isTeamSelected,
  resolveTeamTicketDisplay,
  toggleSelectedTeamId,
} from "@/lib/team-group-view";
import { cn } from "@/lib/utils";
import type { Ticket } from "@/types/ticket";
import type { Team } from "@/types/team";

/** Nyeste sager vist per gruppe i rail når gruppen ikke er valgt. */
export const TEAM_RAIL_TICKET_PREVIEW = 5;

export function DispatchTeamsRail({
  teams,
  ticketsByTeam,
  dragOverTeamId,
  onDragOverTeam,
  onDragLeaveTeam,
  onDropTeam,
  selectedTeamId = null,
  onSelectTeam,
  onTicketClick,
  title = "Grupper",
  description = "Klik en gruppe for at se alle sager — træk hertil for at tildele",
  sectionLabel = "Interne grupper",
  previewLimit,
}: {
  teams: Team[];
  ticketsByTeam: Map<string, Ticket[]>;
  dragOverTeamId: string | null;
  onDragOverTeam: (teamId: string, event: React.DragEvent) => void;
  onDragLeaveTeam: () => void;
  onDropTeam: (team: Team, event: React.DragEvent) => void;
  selectedTeamId?: string | null;
  onSelectTeam?: (teamId: string | null) => void;
  onTicketClick?: (ticket: Ticket) => void;
  title?: string;
  description?: string;
  sectionLabel?: string;
  previewLimit?: number;
}) {
  const limit = previewLimit ?? TEAM_RAIL_TICKET_PREVIEW;

  return (
    <aside
      className="flex min-h-0 flex-col space-y-3 overflow-y-auto"
      aria-labelledby="dispatch-groups-heading"
    >
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
        const isSelected = isTeamSelected(selectedTeamId ?? null, team.id);
        const display = resolveTeamTicketDisplay(
          ticketsByTeam,
          team.id,
          selectedTeamId ?? null,
          limit,
        );
        const isOver = dragOverTeamId === team.id;

        return (
          <div
            key={team.id}
            role="group"
            aria-label={`${team.name}, slip sag her`}
            onDragOver={(event) => onDragOverTeam(team.id, event)}
            onDragLeave={onDragLeaveTeam}
            onDrop={(event) => onDropTeam(team, event)}
            className={cn(
              "rounded-md border-2 border-dashed p-4 transition-colors",
              isOver
                ? "border-star-blue bg-star-blue-light"
                : isSelected
                  ? "border-star-navy bg-star-blue-light/50 ring-2 ring-star-navy/20"
                  : "border-star-blue/30 bg-white",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() =>
                  onSelectTeam?.(toggleSelectedTeamId(selectedTeamId ?? null, team.id))
                }
                disabled={!onSelectTeam}
                aria-pressed={isSelected}
              >
                <p className="text-star-navy font-semibold">{team.name}</p>
                {team.name === "SF" ? (
                  <p className="text-star-navy text-xs font-medium uppercase">Hovedgruppe</p>
                ) : null}
              </button>
              <Badge variant="outline">
                {display.total} sag{display.total === 1 ? "" : "er"}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">{team.members.length} medlemmer</p>
            <div className="mt-3 border-t border-star-blue/15 pt-3">
              <TeamGroupTicketList
                tickets={display.visible}
                total={display.total}
                isSelected={display.isSelected}
                showingAll={display.showingAll}
                previewLimit={limit}
                onTicketClick={onTicketClick}
                ticketHref={(ticketId) => `/tickets/${ticketId}`}
                emptyLabel="Ingen tildelte sager"
              />
            </div>
          </div>
        );
      })}
    </aside>
  );
}
