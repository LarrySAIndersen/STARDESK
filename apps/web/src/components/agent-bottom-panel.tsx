"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AssignmentDropDialog } from "@/components/assignment-drop-dialog";
import { WireTags } from "@/components/wireframe/wire-tags";
import { apiPatch } from "@/lib/api";
import { mergeTicketAssignmentFromDetail } from "@/lib/ticket-assignment";
import { readDraggedTicketId } from "@/lib/ticket-drag";
import { TeamGroupDetailPane } from "@/components/dispatch/team-group-detail-pane";
import { TeamGroupTicketList } from "@/components/dispatch/team-group-ticket-list";
import { serviceDeskTeamIds, teamsForServiceDeskRail } from "@/lib/service-desk-queue";
import {
  buildOpenAssignedTicketsByTeamMap,
  isTeamSelected,
  resolveTeamTicketDisplay,
  ticketDetailHref,
  toggleSelectedTeamId,
} from "@/lib/team-group-view";
import { WirePriorityBadge, WireStatusBadge } from "@/components/wireframe/wire-badge";
import { getTicketsForTeam } from "@/lib/tickets-by-team";
import { sortTeamsForDisplay } from "@/lib/team-categories";
import { routingConfidenceForTeamAssign } from "@/lib/ticket-routing";
import {
  confidenceColor,
  confidenceVerdict,
  confidenceVerdictClass,
} from "@/lib/wireframe-labels";
import { RoutingReadinessBanner } from "@/components/routing-readiness-banner";
import { cn } from "@/lib/utils";
import type { Team } from "@/types/team";
import type { Ticket, TicketDetail } from "@/types/ticket";

type TabId = "teams" | "content" | "slack";

type PendingAssign = Readonly<{
  ticket: Ticket;
  team: Team;
  confidence: number;
}>;

const TEAM_TICKET_PREVIEW = 6;
const PANEL_MAX_HEIGHT = 420;

export function AgentBottomPanel({
  tickets,
  teams,
  slackTabRequest = 0,
  selectedTicket = null,
  draggingTicket = null,
  onTicketAssigned,
  teamsTabLabel = "Grupper",
}: {
  tickets: Ticket[];
  teams: Team[];
  slackTabRequest?: number;
  selectedTicket?: Ticket | null;
  /** Active drag from Nye sager — drives AI ghost overlay and drop targets. */
  draggingTicket?: Ticket | null;
  onTicketAssigned?: (detail: TicketDetail) => void;
  /** First tab label (e.g. Service Desk uses "Sagsdeling"). */
  teamsTabLabel?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const activeDragRef = useRef<Ticket | null>(null);
  const [height, setHeight] = useState(220);
  const [panelOpen, setPanelOpen] = useState(true);
  const [tab, setTab] = useState<TabId>("teams");
  const [selected, setSelected] = useState<Ticket | null>(selectedTicket);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{
    ticket: Ticket;
    x: number;
    y: number;
    team: Team | null;
    confidence: number;
  } | null>(null);
  const [hoverTeamId, setHoverTeamId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAssign | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const deskTeamIds = useMemo(() => serviceDeskTeamIds(teams), [teams]);
  const railTeams = useMemo(
    () => teamsForServiceDeskRail(sortTeamsForDisplay(teams), deskTeamIds),
    [teams, deskTeamIds],
  );
  const ticketsByTeam = useMemo(
    () => buildOpenAssignedTicketsByTeamMap(tickets),
    [tickets],
  );

  const selectedTeam = useMemo(
    () =>
      selectedTeamId
        ? (railTeams.find((t) => isTeamSelected(selectedTeamId, t.id)) ?? null)
        : null,
    [railTeams, selectedTeamId],
  );

  const selectedTeamTickets = useMemo(
    () =>
      selectedTeamId ? getTicketsForTeam(ticketsByTeam, selectedTeamId) : [],
    [selectedTeamId, ticketsByTeam],
  );

  const handleSelectTeam = useCallback((teamId: string | null) => {
    setSelectedTeamId(teamId);
    if (teamId) {
      setPanelOpen(true);
      setHeight(PANEL_MAX_HEIGHT);
      setTab("teams");
    }
  }, []);
  const ticketMap = useMemo(
    () => new Map(tickets.map((t) => [t.id, t])),
    [tickets],
  );

  const openTicketCard = useCallback(
    (ticket: Ticket) => {
      const full = ticketMap.get(ticket.id) ?? ticket;
      setSelected(full);
      setTab("content");
      setPanelOpen(true);
      setHeight(PANEL_MAX_HEIGHT);
    },
    [ticketMap],
  );

  useEffect(() => {
    if (slackTabRequest > 0) {
      setTab("slack");
      setPanelOpen(true);
      setHeight(220);
    }
  }, [slackTabRequest]);

  useEffect(() => {
    if (!selectedTicket) {
      return;
    }
    openTicketCard(selectedTicket);
  }, [selectedTicket, openTicketCard]);

  useEffect(() => {
    if (!draggingTicket) {
      return;
    }
    setTab("teams");
    setPanelOpen(true);
    setHeight((h) => (h < 120 ? 220 : h));
  }, [draggingTicket]);

  const togglePanel = () => {
    if (panelOpen) {
      setHeight(37);
      setPanelOpen(false);
    } else {
      setHeight(220);
      setPanelOpen(true);
    }
  };

  useEffect(() => {
    activeDragRef.current = draggingTicket;
  }, [draggingTicket]);

  useEffect(() => {
    function onDragStart(event: DragEvent) {
      if (!event.dataTransfer) {
        return;
      }
      const id = readDraggedTicketId(event.dataTransfer);
      if (!id) {
        return;
      }
      const ticket = ticketMap.get(id);
      if (ticket) {
        activeDragRef.current = ticket;
      }
    }
    function clearDrag() {
      activeDragRef.current = null;
      setGhost(null);
      setHoverTeamId(null);
    }
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("dragend", clearDrag);
    document.addEventListener("drop", clearDrag);
    return () => {
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("dragend", clearDrag);
      document.removeEventListener("drop", clearDrag);
    };
  }, [ticketMap]);

  useEffect(() => {
    function onDragOver(e: DragEvent) {
      const ticket = activeDragRef.current ?? draggingTicket;
      if (!ticket) return;
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "move";
      }
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const dropZone = el?.closest("[data-team-drop-id]") as HTMLElement | null;
      const teamId = dropZone?.dataset.teamDropId ?? null;
      const team = teamId ? railTeams.find((t) => t.id === teamId) ?? null : null;
      const conf = team ? routingConfidenceForTeamAssign(ticket, team.id, teams) : 0;
      setHoverTeamId(teamId);
      setGhost({
        ticket,
        x: e.clientX + 16,
        y: e.clientY - 30,
        team,
        confidence: conf,
      });
    }
    window.addEventListener("dragover", onDragOver);
    return () => {
      window.removeEventListener("dragover", onDragOver);
    };
  }, [draggingTicket, railTeams, teams]);

  const handleTeamDrop = useCallback(
    (team: Team) => (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const id = readDraggedTicketId(e.dataTransfer);
      const ticket =
        (id ? ticketMap.get(id) : null) ??
        activeDragRef.current ??
        draggingTicket ??
        null;
      setGhost(null);
      setHoverTeamId(null);
      if (!ticket) return;
      const confidence = routingConfidenceForTeamAssign(ticket, team.id, teams);
      setPending({ ticket, team, confidence });
      setAssignOpen(true);
    },
    [ticketMap, teams, draggingTicket],
  );

  async function confirmAssignment(data: {
    teamId: string;
    reason: string;
    faultDisplayed: boolean;
  }) {
    if (!pending) return;
    setSaving(true);
    setError(null);
    try {
      const detail = await apiPatch<TicketDetail>(
        `/api/v1/tickets/${pending.ticket.id}/assignment`,
        {
          assigned_team_id: data.teamId,
          assigned_user_id: null,
          assignment_reason: data.reason,
          fault_displayed: data.faultDisplayed,
        },
      );
      const merged = mergeTicketAssignmentFromDetail(pending.ticket, detail);
      setSelected(merged);
      setSelectedTeamId(data.teamId);
      setTab("teams");
      setPanelOpen(true);
      onTicketAssigned?.(detail);
      setAssignOpen(false);
      setPending(null);
      activeDragRef.current = null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke tildele sagen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div
        id="dispatch-panel"
        ref={panelRef}
        className="wire-bottom-panel"
        style={{ height: panelOpen ? height : 37 }}
      >
        <div
          className="absolute top-0 right-0 left-0 z-10 h-1.5 cursor-ns-resize hover:bg-star-red/15"
          role="separator"
          aria-orientation="horizontal"
          onMouseDown={(e) => {
            e.preventDefault();
            const startY = e.clientY;
            const startH = height;
            function move(ev: MouseEvent) {
              const next = Math.min(420, Math.max(37, startH + (startY - ev.clientY)));
              setHeight(next);
              setPanelOpen(next > 40);
            }
            function up() {
              window.removeEventListener("mousemove", move);
              window.removeEventListener("mouseup", up);
            }
            window.addEventListener("mousemove", move);
            window.addEventListener("mouseup", up);
          }}
        />
        <div className="wire-bp-tabs">
          {(
            [
              ["teams", teamsTabLabel, railTeams.length],
              ["content", "Sagsindhold", selected?.ticket_number ?? "—"],
              ["slack", "Slack", null],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              data-tab={id}
              className={cn("wire-bp-tab", tab === id && "wire-bp-tab--active")}
              onClick={() => {
                setTab(id);
                if (!panelOpen) togglePanel();
              }}
            >
              {label}
              {count != null ? (
                <span className="rounded-full bg-white/20 px-1.5 text-[9px] tab-active:bg-star-red">
                  {count}
                </span>
              ) : null}
            </button>
          ))}
          <button
            type="button"
            className="ml-auto px-3.5 text-white/60 hover:text-white"
            onClick={togglePanel}
            aria-label={panelOpen ? "Skjul panel" : "Vis panel"}
          >
            {panelOpen ? "▼" : "▲"}
          </button>
        </div>

        {panelOpen && tab === "teams" ? (
          <div className="flex h-[calc(100%-37px)] min-h-0 flex-col">
            {selectedTeam ? (
              <TeamGroupDetailPane
                team={selectedTeam}
                tickets={selectedTeamTickets}
                onClose={() => setSelectedTeamId(null)}
                onTicketClick={openTicketCard}
              />
            ) : null}
            <div className="flex min-h-0 flex-1 overflow-x-auto p-3">
            {railTeams.map((team) => {
              const isSelected = isTeamSelected(selectedTeamId, team.id);
              const isHover = hoverTeamId === team.id;
              const conf =
                ghost?.team?.id === team.id ? ghost.confidence : 0;
              const dropOk = conf >= 50;
              const display = resolveTeamTicketDisplay(
                ticketsByTeam,
                team.id,
                selectedTeamId,
                TEAM_TICKET_PREVIEW,
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
                      handleSelectTeam(toggleSelectedTeamId(selectedTeamId, team.id))
                    }
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
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleTeamDrop(team)}
                    className={cn(
                      "wire-bereder-streg relative mb-2 flex min-h-[2.25rem] items-center justify-center rounded-[2px] border-2 border-dashed px-2 py-1.5 text-center text-[10px] font-semibold transition-all",
                      isHover
                        ? dropOk
                          ? "border-[#1A7A44] bg-[#E6F5EC] text-[#1A7A44] ring-2 ring-[#1A7A44]/25"
                          : "border-star-red bg-star-red-light text-star-red ring-2 ring-star-red/20"
                        : "border-[var(--gray-border)] bg-[var(--gray-bg)] text-[var(--gray-mid)]",
                    )}
                    aria-label={`Slip sag på ${team.name}`}
                  >
                    {isHover ? (
                      <>
                        {dropOk ? "✓" : "✗"} Slip her — {conf}% match
                      </>
                    ) : (
                      "Træk sag hertil"
                    )}
                  </div>

                  <TeamGroupTicketList
                    tickets={display.visible}
                    total={display.total}
                    isSelected={isSelected}
                    showingAll={display.showingAll}
                    previewLimit={TEAM_TICKET_PREVIEW}
                    onTicketClick={openTicketCard}
                  />
                  {isSelected ? (
                    <p className="text-[10px] text-[var(--gray-mid)]">
                      Eller vælg sag i listen ovenfor
                    </p>
                  ) : null}
                  <p className="mt-1.5 text-[9px] text-[var(--gray-mid)]">
                    {team.members.length} medlemmer
                  </p>
                </div>
              );
            })}
            </div>
          </div>
        ) : null}

        {panelOpen && tab === "content" ? (
          <div className="flex h-[calc(100%-37px)] gap-3 overflow-x-auto p-3">
            {selected ? (
              <>
                <div className="w-[240px] shrink-0">
                  <div className="wire-card mb-0">
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <WireStatusBadge status={selected.status} />
                      <WirePriorityBadge priority={selected.priority} />
                    </div>
                    <p className="text-[9px] font-bold tracking-widest text-[var(--gray-mid)] uppercase">
                      Sag {selected.ticket_number}
                    </p>
                    <p className="text-star-navy mt-1 text-[13px] font-bold">
                      {selected.title}
                    </p>
                    <Link
                      href={ticketDetailHref(selected.id)}
                      className="text-star-blue mt-2 inline-block text-[11px] font-semibold hover:underline"
                    >
                      Åbn fuld sag →
                    </Link>
                    <WireTags tags={selected.tags} />
                    {selected.routing && !selected.routing.routing_ready ? (
                      <div className="mt-2">
                        <RoutingReadinessBanner routing={selected.routing} />
                      </div>
                    ) : null}
                    <p className="text-[var(--star-text-muted)] mt-2 text-[11px] leading-relaxed">
                      {selected.assignment_reason?.slice(0, 300) ??
                        selected.title}
                    </p>
                    {selected.assigned_team_name ? (
                      <p className="mt-2 text-[11px]">
                        <span className="text-[var(--gray-mid)]">Gruppe: </span>
                        <strong>{selected.assigned_team_name}</strong>
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="min-w-[280px] flex-1">
                  <div className="rounded-[2px] border border-[#B0B4EC] border-l-4 border-l-[var(--ai-purple)] bg-[var(--ai-purple-bg)] p-3">
                    <p className="mb-2 text-[10px] font-bold tracking-wide text-[var(--ai-purple)] uppercase">
                      AI-konfidens pr. gruppe
                    </p>
                    {railTeams.slice(0, 8).map((team) => {
                      const score = routingConfidenceForTeamAssign(
                        selected,
                        team.id,
                        teams,
                      );
                      return (
                        <div
                          key={team.id}
                          className="mb-1 flex items-center gap-2 text-[11px]"
                        >
                          <span className="text-star-navy min-w-[72px] truncate font-bold">
                            {team.name}
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#E8E8E4]">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${score}%`,
                                background: confidenceColor(score),
                              }}
                            />
                          </div>
                          <span
                            className="min-w-[32px] text-right font-bold"
                            style={{ color: confidenceColor(score) }}
                          >
                            {score}%
                          </span>
                          <span
                            className={cn(
                              "rounded-[2px] px-1.5 py-px text-[10px] font-bold",
                              confidenceVerdictClass(score) === "cv-good" &&
                                "bg-[#E6F5EC] text-[#1A7A44]",
                              confidenceVerdictClass(score) === "cv-ok" &&
                                "bg-[#FFF3CD] text-[#7A4800]",
                              confidenceVerdictClass(score) === "cv-bad" &&
                                "bg-star-red-light text-star-red",
                            )}
                          >
                            {confidenceVerdict(score)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <p className="w-full py-6 text-center text-xs text-[var(--gray-mid)]">
                Klik på en sag i tabellen eller under en gruppe — eller træk til en gruppe
              </p>
            )}
          </div>
        ) : null}

        {panelOpen && tab === "slack" ? (
          <div className="flex h-[calc(100%-37px)] flex-col gap-2 overflow-y-auto p-3">
            <p className="text-[10px] font-bold tracking-wide text-[var(--gray-mid)] uppercase">
              #it-support — prototype
            </p>
            <div className="flex gap-2 text-xs">
              <span className="wire-avatar-sm bg-star-navy text-[9px]">LK</span>
              <div>
                <p>
                  <strong>Lars K.</strong>{" "}
                  <span className="text-[var(--gray-mid)]">09:22</span>
                </p>
                <p>KB5034441 er synderen. Rollback virker.</p>
              </div>
            </div>
            <div className="rounded-[2px] border border-[#B0B4EC] border-l-4 border-l-[var(--ai-purple)] bg-[var(--ai-purple-bg)] p-2 text-[11px] text-[#2A2C7A]">
              <strong>AI-analyse:</strong> Løsning identificeret — foreslås at lukke sag og
              oprette knowledge article.
            </div>
          </div>
        ) : null}
      </div>

      {ghost ? (
        <div
          className="border-border bg-popover text-popover-foreground pointer-events-none fixed z-[9999] min-w-[290px] rounded border-2 p-3 shadow-xl"
          style={{
            left: ghost.x,
            top: ghost.y,
            transform: "rotate(-1.5deg)",
          }}
        >
          <p className="text-star-navy text-[13px] font-bold">{ghost.ticket.title}</p>
          <WireTags tags={ghost.ticket.tags} />
          {ghost.ticket.routing?.suggested_team_name ? (
            <p className="mt-1 text-[10px] text-[#2A2C7A]">
              Foreslået: {ghost.ticket.routing.suggested_team_name}
            </p>
          ) : null}
          {ghost.team ? (
            <div className="mt-2 flex items-center gap-2 border-t border-[var(--gray-border)] pt-2">
              <span className="wire-ai-pill text-[9px]">AI</span>
              <span className="text-[10px] font-bold text-[var(--gray-mid)]">
                {ghost.team.name}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#E8E8E4]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${ghost.confidence}%`,
                    background: confidenceColor(ghost.confidence),
                  }}
                />
              </div>
              <span
                className="text-[13px] font-bold"
                style={{ color: confidenceColor(ghost.confidence) }}
              >
                {ghost.confidence}%
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="text-star-red px-4 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {assignOpen && pending ? (
        <AssignmentDropDialog
          ticketTitle={pending.ticket.title}
          teamName={pending.team.name}
          teamId={pending.team.id}
          teams={teams}
          confidence={pending.confidence}
          routingReasonDa={pending.ticket.routing?.routing_reason_da}
          onConfirm={confirmAssignment}
          onCancel={() => !saving && (setAssignOpen(false), setPending(null))}
        />
      ) : null}
    </>
  );
}
