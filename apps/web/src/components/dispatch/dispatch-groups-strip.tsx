"use client";

import { TeamGroupTicketList } from "@/components/dispatch/team-group-ticket-list";
import {
  TEAM_GROUP_PREVIEW_LIMIT,
  resolveTeamTicketDisplay,
  isTeamSelected,
  toggleSelectedTeamId,
} from "@/lib/team-group-view";
import { cn } from "@/lib/utils";
import type { Team } from "@/types/team";
import type { Ticket } from "@/types/ticket";

export const GROUPS_STRIP_TICKET_PREVIEW = TEAM_GROUP_PREVIEW_LIMIT;

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
        const isSelected = isTeamSelected(selectedTeamId ?? null, team.id);
        const isHover = dragOverTeamId === team.id;
        const display = resolveTeamTicketDisplay(
          ticketsByTeam,
          team.id,
          selectedTeamId ?? null,
          GROUPS_STRIP_TICKET_PREVIEW,
        );

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
              onClick={() =>
                onSelectTeam?.(toggleSelectedTeamId(selectedTeamId ?? null, team.id))
              }
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
                {display.total}
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

            <TeamGroupTicketList
              tickets={display.visible}
              total={display.total}
              isSelected={display.isSelected}
              showingAll={display.showingAll}
              previewLimit={GROUPS_STRIP_TICKET_PREVIEW}
              ticketHref={ticketHref}
            />
            <p className="mt-1.5 text-[9px] text-[var(--gray-mid)]">
              {team.members.length} medlemmer
            </p>
          </div>
        );
      })}
    </div>
  );
}
