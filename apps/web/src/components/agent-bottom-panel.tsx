"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AssignmentDropDialog } from "@/components/assignment-drop-dialog";
import { WireTags } from "@/components/wireframe/wire-tags";
import { apiPatch } from "@/lib/api";
import { mergeTicketAssignmentFromDetail } from "@/lib/ticket-assignment";
import { readDraggedTicketId } from "@/lib/ticket-drag";
import { isOpenTicket } from "@/lib/service-desk-queue";
import { routingConfidenceForAssign } from "@/lib/ticket-routing";
import {
  confidenceColor,
  confidenceVerdict,
  confidenceVerdictClass,
} from "@/lib/wireframe-labels";
import { RoutingReadinessBanner } from "@/components/routing-readiness-banner";
import { cn } from "@/lib/utils";
import type { Team, TeamMember } from "@/types/team";
import type { Ticket, TicketDetail } from "@/types/ticket";

type TabId = "teams" | "content" | "slack";

type TechTarget = Readonly<{
  key: string;
  displayName: string;
  role: string;
  teamId: string;
  teamName: string;
  color: string;
  loadPct: number;
}>;

type PendingAssign = Readonly<{
  ticket: Ticket;
  target: TechTarget;
  confidence: number;
}>;

function memberInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function loadClass(pct: number): string {
  if (pct >= 85) return "bg-star-red";
  if (pct >= 55) return "bg-[#C87000]";
  return "bg-[#1A7A44]";
}

function buildTechnicians(teams: Team[]): TechTarget[] {
  const colors = ["#1B3A6B", "#2A6099", "#C8102E", "#1A7A44", "#555552"];
  const out: TechTarget[] = [];
  let i = 0;
  for (const team of teams) {
    for (const m of team.members) {
      const hash = (m.user_id.charCodeAt(0) + m.display_name.length * 7) % 100;
      out.push({
        key: m.user_id,
        displayName: m.display_name,
        role: m.role_label || team.name,
        teamId: team.id,
        teamName: team.name,
        color: colors[i % colors.length] ?? "#1B3A6B",
        loadPct: 20 + (hash % 75),
      });
      i += 1;
    }
  }
  return out;
}

const TECH_TICKET_PREVIEW = 5;

function buildTicketsByUser(tickets: Ticket[]): Map<string, Ticket[]> {
  const map = new Map<string, Ticket[]>();
  for (const ticket of tickets) {
    if (!ticket.assigned_user_id || !isOpenTicket(ticket)) {
      continue;
    }
    const list = map.get(ticket.assigned_user_id) ?? [];
    list.push(ticket);
    map.set(ticket.assigned_user_id, list);
  }
  for (const [userId, list] of map) {
    list.sort(
      (a, b) =>
        new Date(b.updated_at ?? b.created_at).getTime() -
        new Date(a.updated_at ?? a.created_at).getTime(),
    );
    map.set(userId, list.slice(0, TECH_TICKET_PREVIEW));
  }
  return map;
}

export function AgentBottomPanel({
  tickets,
  teams,
  slackTabRequest = 0,
  selectedTicket = null,
  draggingTicket = null,
  onTicketAssigned,
}: {
  tickets: Ticket[];
  teams: Team[];
  slackTabRequest?: number;
  selectedTicket?: Ticket | null;
  /** Active drag from Seneste sager — drives AI ghost overlay and drop targets. */
  draggingTicket?: Ticket | null;
  onTicketAssigned?: (detail: TicketDetail) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const activeDragRef = useRef<Ticket | null>(null);
  const [height, setHeight] = useState(220);
  const [panelOpen, setPanelOpen] = useState(true);
  const [tab, setTab] = useState<TabId>("teams");
  const [selected, setSelected] = useState<Ticket | null>(selectedTicket);
  const [ghost, setGhost] = useState<{
    ticket: Ticket;
    x: number;
    y: number;
    target: TechTarget | null;
    confidence: number;
  } | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAssign | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const technicians = useMemo(() => buildTechnicians(teams), [teams]);
  const ticketsByUser = useMemo(() => buildTicketsByUser(tickets), [tickets]);
  const ticketMap = useMemo(
    () => new Map(tickets.map((t) => [t.id, t])),
    [tickets],
  );

  useEffect(() => {
    if (slackTabRequest > 0) {
      setTab("slack");
      setPanelOpen(true);
      setHeight(220);
    }
  }, [slackTabRequest]);

  useEffect(() => {
    setSelected(selectedTicket);
  }, [selectedTicket]);

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
      setHoverKey(null);
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
      const card = el?.closest("[data-tech-key]") as HTMLElement | null;
      const key = card?.dataset.techKey ?? null;
      const target = key ? technicians.find((t) => t.key === key) ?? null : null;
      const conf = target
        ? routingConfidenceForAssign(ticket, target.key, teams)
        : 0;
      setHoverKey(key);
      setGhost({
        ticket,
        x: e.clientX + 16,
        y: e.clientY - 30,
        target,
        confidence: conf,
      });
    }
    window.addEventListener("dragover", onDragOver);
    return () => {
      window.removeEventListener("dragover", onDragOver);
    };
  }, [draggingTicket, technicians, teams]);

  const handleTechDrop = useCallback(
    (target: TechTarget) => (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const id = readDraggedTicketId(e.dataTransfer);
      const ticket =
        (id ? ticketMap.get(id) : null) ??
        activeDragRef.current ??
        draggingTicket ??
        null;
      setGhost(null);
      setHoverKey(null);
      if (!ticket) return;
      const confidence = routingConfidenceForAssign(ticket, target.key, teams);
      setPending({ ticket, target, confidence });
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
          assigned_user_id: pending.target.key,
          assignment_reason: data.reason,
          fault_displayed: data.faultDisplayed,
        },
      );
      const merged = mergeTicketAssignmentFromDetail(pending.ticket, detail);
      setSelected(merged);
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

  const teamsByName = useMemo(() => {
    const map = new Map<string, TeamMember[]>();
    for (const t of technicians) {
      const list = map.get(t.teamName) ?? [];
      list.push({
        user_id: t.key,
        display_name: t.displayName,
        email: "",
        role: "",
        role_label: t.role,
        joined_at: "",
      });
      map.set(t.teamName, list);
    }
    return map;
  }, [technicians]);

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
              ["teams", "Teams", technicians.length],
              ["content", "Sagsindhold", selected?.ticket_number ?? "—"],
              ["slack", "Slack", null],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
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
          <div className="flex h-[calc(100%-37px)] overflow-x-auto p-3">
            {Array.from(teamsByName.entries()).map(([teamName, members]) => (
              <div key={teamName} className="mr-3 w-[185px] shrink-0">
                <div className="mb-1.5 flex items-center justify-between rounded-[2px] bg-star-blue-light px-2 py-1.5 text-[11px] font-bold text-star-navy">
                  {teamName}
                  <span className="rounded-full bg-star-navy px-1.5 text-[9px] text-white">
                    {members.length}
                  </span>
                </div>
                {technicians
                  .filter((t) => t.teamName === teamName)
                  .map((tech) => {
                    const isHover = hoverKey === tech.key;
                    const conf =
                      ghost?.target?.key === tech.key ? ghost.confidence : 0;
                    const dropOk = conf >= 50;
                    const assignedTickets = ticketsByUser.get(tech.key) ?? [];
                    return (
                      <div
                        key={tech.key}
                        data-tech-key={tech.key}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleTechDrop(tech)}
                        className={cn(
                          "relative mb-1 flex flex-col gap-1 rounded-[2px] border border-[var(--gray-border)] bg-[var(--gray-bg)] p-2 transition-all",
                          isHover &&
                            (dropOk
                              ? "border-[#1A7A44] bg-[#E6F5EC] ring-2 ring-[#1A7A44]/20"
                              : "border-star-red bg-star-red-light ring-2 ring-star-red/20"),
                        )}
                      >
                        <div className="flex items-center gap-2">
                        {isHover ? (
                          <span
                            className={cn(
                              "absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full text-[11px] font-bold text-white",
                              dropOk ? "bg-[#1A7A44]" : "bg-star-red",
                            )}
                          >
                            {dropOk ? "✓" : "✗"}
                          </span>
                        ) : null}
                        <span
                          className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                          style={{ background: tech.color }}
                        >
                          {memberInitials(tech.displayName)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-bold text-star-navy">
                            {tech.displayName}
                          </p>
                          <p className="truncate text-[10px] text-[var(--gray-mid)]">
                            {tech.role}
                          </p>
                        </div>
                        <div className="ml-auto shrink-0">
                          <div className="h-1 w-8 overflow-hidden rounded-full bg-[#E0E0DC]">
                            <div
                              className={cn("h-full rounded-full", loadClass(tech.loadPct))}
                              style={{ width: `${tech.loadPct}%` }}
                            />
                          </div>
                          <p className="text-right text-[9px] text-[var(--gray-mid)]">
                            {tech.loadPct}%
                          </p>
                        </div>
                        </div>
                        {assignedTickets.length > 0 ? (
                          <ul className="border-t border-[var(--gray-border)] pt-1.5">
                            {assignedTickets.map((ticket) => (
                              <li
                                key={ticket.id}
                                className="truncate text-[10px] font-medium text-star-navy"
                                title={`${ticket.ticket_number} ${ticket.title}`}
                              >
                                <span className="font-mono">{ticket.ticket_number}</span>
                                <span className="text-muted-foreground ml-1 font-normal">
                                  {ticket.title}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        ) : null}

        {panelOpen && tab === "content" ? (
          <div className="flex h-[calc(100%-37px)] gap-3 overflow-x-auto p-3">
            {selected ? (
              <>
                <div className="w-[220px] shrink-0">
                  <div className="wire-card mb-0">
                    <p className="text-[9px] font-bold tracking-widest text-[var(--gray-mid)] uppercase">
                      Sag {selected.ticket_number}
                    </p>
                    <p className="text-star-navy mt-1 text-[13px] font-bold">
                      {selected.title}
                    </p>
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
                  </div>
                </div>
                <div className="min-w-[280px] flex-1">
                  <div className="rounded-[2px] border border-[#B0B4EC] border-l-4 border-l-[var(--ai-purple)] bg-[var(--ai-purple-bg)] p-3">
                    <p className="mb-2 text-[10px] font-bold tracking-wide text-[var(--ai-purple)] uppercase">
                      AI-konfidens pr. tekniker
                    </p>
                    {technicians.slice(0, 5).map((tech) => {
                      const score = routingConfidenceForAssign(selected, tech.key, teams);
                      return (
                        <div
                          key={tech.key}
                          className="mb-1 flex items-center gap-2 text-[11px]"
                        >
                          <span
                            className="min-w-[55px] font-bold"
                            style={{ color: tech.color }}
                          >
                            {tech.displayName.split(" ")[0]}
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
                Klik på en sag i tabellen — eller træk til bundpanelet for at se indhold
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
          className="pointer-events-none fixed z-[9999] min-w-[290px] rounded border-2 border-star-navy bg-white p-3 shadow-xl"
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
          {ghost.target ? (
            <div className="mt-2 flex items-center gap-2 border-t border-[var(--gray-border)] pt-2">
              <span className="wire-ai-pill text-[9px]">AI</span>
              <span className="text-[10px] font-bold text-[var(--gray-mid)]">
                {ghost.target.displayName}
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
          teamName={pending.target.teamName}
          teamId={pending.target.teamId}
          teams={teams}
          confidence={pending.confidence}
          routingReasonDa={pending.ticket.routing?.routing_reason_da}
          technicianName={pending.target.displayName}
          onConfirm={confirmAssignment}
          onCancel={() => !saving && (setAssignOpen(false), setPending(null))}
        />
      ) : null}

    </>
  );
}
