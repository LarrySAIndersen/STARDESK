"use client";

import { ChevronDown, PanelRightClose, PanelRightOpen } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { TeamGroupTicketList } from "@/components/dispatch/team-group-ticket-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  panelOpen = true,
  onTogglePanel,
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
  /** When set with onTogglePanel, shows ▼/▲ to hide the whole rail (parent controls layout). */
  panelOpen?: boolean;
  onTogglePanel?: () => void;
}) {
  const limit = previewLimit ?? TEAM_RAIL_TICKET_PREVIEW;
  const listId = useId();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!selectedTeamId) {
      return;
    }
    setExpandedIds((prev) => {
      if (prev.has(selectedTeamId)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(selectedTeamId);
      return next;
    });
  }, [selectedTeamId]);

  function toggleExpanded(teamId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  }

  const rail = (
    <aside
      className="flex min-h-0 flex-col overflow-y-auto"
      aria-labelledby="dispatch-groups-heading"
    >
      <div className="star-section-header shrink-0 rounded-t-md">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground mb-1 text-[10px] font-bold tracking-widest uppercase">
              {sectionLabel}
            </p>
            <h2 id="dispatch-groups-heading" className="star-section-title">
              {title}
            </h2>
          </div>
          {onTogglePanel ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-star-navy/25 text-star-navy hover:bg-star-blue-light/60 shrink-0 gap-1 text-xs font-semibold"
              onClick={onTogglePanel}
              aria-label={panelOpen ? "Skjul interne grupper" : "Vis interne grupper"}
              aria-expanded={panelOpen}
            >
              {panelOpen ? (
                <>
                  <PanelRightClose className="size-3.5" aria-hidden />
                  Skjul
                </>
              ) : (
                <>
                  <PanelRightOpen className="size-3.5" aria-hidden />
                  Vis
                </>
              )}
            </Button>
          ) : null}
        </div>
        <p className="star-section-desc">{description}</p>
      </div>
      <div className={cn("space-y-3", onTogglePanel ? "p-3" : "")}>
      {teams.map((team) => {
        const isSelected = isTeamSelected(selectedTeamId ?? null, team.id);
        const display = resolveTeamTicketDisplay(
          ticketsByTeam,
          team.id,
          selectedTeamId ?? null,
          limit,
        );
        const isOver = dragOverTeamId === team.id;
        const isExpanded = expandedIds.has(team.id) || isOver;
        const panelId = `${listId}-${team.id}`;

        return (
          <div
            key={team.id}
            role="group"
            aria-label={`${team.name}, slip sag her`}
            onDragOver={(event) => onDragOverTeam(team.id, event)}
            onDragLeave={onDragLeaveTeam}
            onDrop={(event) => onDropTeam(team, event)}
            className={cn(
              "rounded-md border-2 border-dashed transition-colors",
              isExpanded ? "p-4" : "px-3 py-2",
              isOver
                ? "border-star-blue bg-star-blue-light"
                : isSelected
                  ? "border-star-navy bg-star-blue-light/50 ring-2 ring-star-navy/20"
                  : "border-star-blue/30 bg-card",
            )}
          >
            <div className="flex items-start gap-2">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0 rounded p-0.5 transition-colors"
                onClick={() => toggleExpanded(team.id)}
                aria-expanded={isExpanded}
                aria-controls={panelId}
                aria-label={isExpanded ? `Fold ${team.name} sammen` : `Fold ${team.name} ud`}
              >
                <ChevronDown
                  className={cn("size-4 transition-transform", isExpanded && "rotate-180")}
                  aria-hidden
                />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-foreground font-semibold">{team.name}</p>
                    {team.name === "SF" ? (
                      <p className="text-muted-foreground text-xs font-medium uppercase">
                        Hovedgruppe
                      </p>
                    ) : null}
                    {!isExpanded ? (
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {display.total} sag{display.total === 1 ? "" : "er"} ·{" "}
                        {team.members.length} medlemmer
                      </p>
                    ) : null}
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {display.total} sag{display.total === 1 ? "" : "er"}
                  </Badge>
                </div>
                {isExpanded ? (
                  <p className="text-muted-foreground mt-2 text-xs">
                    {team.members.length} medlemmer
                    {onSelectTeam ? (
                      <>
                        {" · "}
                        <button
                          type="button"
                          className="text-star-blue hover:text-star-navy font-semibold underline underline-offset-2"
                          onClick={() =>
                            onSelectTeam(toggleSelectedTeamId(selectedTeamId ?? null, team.id))
                          }
                          aria-pressed={isSelected}
                        >
                          {isSelected ? "Vis forhåndsvisning" : "Vis alle sager"}
                        </button>
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </div>
            {isExpanded ? (
              <div id={panelId} className="mt-3 border-t border-star-blue/15 pt-3">
                <div
                  className={cn(
                    "wire-bereder-streg mb-3 flex min-h-[2rem] items-center justify-center rounded-[2px] border-2 border-dashed px-2 py-1.5 text-center text-[10px] font-semibold",
                    isOver
                      ? "border-[#1A7A44] bg-[#E6F5EC] text-[#1A7A44]"
                      : "border-[var(--gray-border)] bg-[var(--gray-bg)] text-[var(--gray-mid)]",
                  )}
                >
                  {isOver ? "Slip sag her" : "Træk sag hertil"}
                </div>
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
            ) : null}
          </div>
        );
      })}
      </div>
    </aside>
  );

  if (!onTogglePanel) {
    return rail;
  }

  return (
    <div className="star-section-card flex h-full min-h-0 flex-col overflow-hidden">
      {rail}
    </div>
  );
}
