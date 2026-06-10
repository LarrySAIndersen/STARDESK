"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  dispatchBoardTicketsChanged,
  useBoardDataSync,
} from "@/hooks/use-board-data-sync";

import { AgentBottomPanel } from "@/components/agent-bottom-panel";
import { AssignmentDropDialog } from "@/components/assignment-drop-dialog";
import { ClearFiltersButton } from "@/components/clear-filters-button";
import { DispatchTeamsRail } from "@/components/dispatch/dispatch-teams-rail";
import {
  collectServiceDeskFilterOptions,
  TicketTableColumnFilters,
} from "@/components/service-desk/ticket-table-column-filters";
import { TicketSearchInput } from "@/components/ticket-search-input";
import { ResizableSplit } from "@/components/ui/resizable-split";
import { WireframeTicketTable } from "@/components/wireframe/wireframe-ticket-table";
import { Button } from "@/components/ui/button";
import { apiPatch } from "@/lib/api";
import {
  mergeTicketAssignmentFromDetail,
  mergeTicketAssignmentInList,
  reconcileLocalTicketsWithServer,
} from "@/lib/ticket-assignment";
import {
  buildOpenAssignedTicketsByTeamMap,
  isTeamSelected,
} from "@/lib/team-group-view";
import { getTicketsForTeam } from "@/lib/tickets-by-team";
import { partitionTeamsByCategory, sortTeamsForDisplay } from "@/lib/team-categories";
import { readDraggedTicketId } from "@/lib/ticket-drag";
import { routingConfidenceForTeamAssign } from "@/lib/ticket-routing";
import { ticketMatchesSearch } from "@/lib/ticket-tags";
import {
  filterByServiceDeskQueue,
  isOpenTicket,
  paginateTickets,
  serviceDeskTeamIds,
  teamsForServiceDeskRail,
  ticketsForServiceDeskTable,
  ticketsForServiceDeskTeamRail,
  type ServiceDeskQueueFilter,
} from "@/lib/service-desk-queue";
import {
  applyServiceDeskTableFilters,
  DEFAULT_SERVICE_DESK_TABLE_FILTERS,
  hasActiveServiceDeskTableFilters,
  sortServiceDeskTable,
  type ServiceDeskTableFilters,
} from "@/lib/service-desk-table-filters";
import { cn } from "@/lib/utils";
import type { Team } from "@/types/team";
import type { Ticket, TicketDetail } from "@/types/ticket";

const Gauge = dynamic(
  () => import("@/components/dashboard/gauge").then((m) => m.Gauge),
  { loading: () => <div className="bg-muted/40 h-28 animate-pulse rounded-md" /> },
);

const PAGE_SIZE = 20;
const PAGE_OFFSETS = [0, 20, 40, 60] as const;
const GROUPS_RAIL_STORAGE_KEY = "stardesk-service-desk-groups-rail-open";

function readGroupsRailOpen(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  try {
    return localStorage.getItem(GROUPS_RAIL_STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

const QUEUE_TABS: { id: ServiceDeskQueueFilter; label: string }[] = [
  { id: "all", label: "Alle sager" },
  { id: "desk", label: "I service desk" },
  { id: "teams", label: "Ude i teams" },
];

type PendingDrop = Readonly<{
  ticketId: string;
  ticketTitle: string;
  teamId?: string;
  teamName?: string;
  confidence?: number;
  routingReasonDa?: string | null;
}>;

export function ServiceDeskView({
  tickets,
  teams,
}: {
  tickets: Ticket[];
  teams: Team[];
}) {
  const router = useRouter();
  const [queue, setQueue] = useState<ServiceDeskQueueFilter>("desk");
  const [search, setSearch] = useState("");
  const [tableFilters, setTableFilters] = useState<ServiceDeskTableFilters>(
    DEFAULT_SERVICE_DESK_TABLE_FILTERS,
  );
  const [offset, setOffset] = useState(0);
  const [dragOverTeamId, setDragOverTeamId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingDrop | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [localTickets, setLocalTickets] = useState<Ticket[]>(tickets);
  const [localTeams, setLocalTeams] = useState<Team[]>(teams);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [draggingTicket, setDraggingTicket] = useState<Ticket | null>(null);
  const draggingTicketRef = useRef<Ticket | null>(null);
  const [groupsRailOpen, setGroupsRailOpen] = useState(true);

  useEffect(() => {
    setGroupsRailOpen(readGroupsRailOpen());
  }, []);

  const toggleGroupsRail = useCallback(() => {
    setGroupsRailOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(GROUPS_RAIL_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore quota / private mode */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    setLocalTickets((prev) => reconcileLocalTicketsWithServer(prev, tickets));
  }, [tickets]);

  useEffect(() => {
    setLocalTeams(teams);
  }, [teams]);

  const { refreshNow } = useBoardDataSync({
    setTickets: setLocalTickets,
    setTeams: setLocalTeams,
    onError: setSyncError,
  });

  const handleTicketAssigned = useCallback((detail: TicketDetail) => {
    setLocalTickets((prev) => {
      const existing = prev.find((ticket) => ticket.id === detail.id);
      if (!existing) {
        return prev;
      }
      const merged = mergeTicketAssignmentFromDetail(existing, detail);
      setSelectedTicket(merged);
      return prev.map((ticket) => (ticket.id === merged.id ? merged : ticket));
    });
    draggingTicketRef.current = null;
    setDraggingTicket(null);
    fireAndForget(refreshNow());
    router.refresh();
  }, [refreshNow, router]);

  const internalTeams = useMemo(() => {
    const { internal } = partitionTeamsByCategory(localTeams);
    return sortTeamsForDisplay(internal);
  }, [localTeams]);

  const deskTeamIds = useMemo(() => serviceDeskTeamIds(internalTeams), [internalTeams]);

  const railTeams = useMemo(
    () => teamsForServiceDeskRail(internalTeams, deskTeamIds),
    [internalTeams, deskTeamIds],
  );

  const queueTickets = useMemo(
    () => filterByServiceDeskQueue(localTickets, queue, deskTeamIds),
    [localTickets, queue, deskTeamIds],
  );

  const openTickets = useMemo(() => {
    const searched = queueTickets.filter((t) => ticketMatchesSearch(t, search));
    const filtered = applyServiceDeskTableFilters(searched, tableFilters);
    return sortServiceDeskTable(filtered, tableFilters.sort);
  }, [queueTickets, search, tableFilters]);

  /** Venstre tabel: kun kø/desk — aldrig samme sag som i gruppe-rail. */
  const tableTickets = useMemo(
    () => ticketsForServiceDeskTable(openTickets, deskTeamIds),
    [openTickets, deskTeamIds],
  );

  const filterOptions = useMemo(
    () => collectServiceDeskFilterOptions(tableTickets),
    [tableTickets],
  );

  const columnFiltersActive = hasActiveServiceDeskTableFilters(tableFilters);

  const pageTickets = useMemo(
    () => paginateTickets(tableTickets, offset, PAGE_SIZE),
    [tableTickets, offset],
  );

  const railTeamTickets = useMemo(() => {
    const open = localTickets.filter(isOpenTicket);
    const searched = open.filter((t) => ticketMatchesSearch(t, search));
    const pool =
      queue === "teams"
        ? filterByServiceDeskQueue(searched, "teams", deskTeamIds)
        : ticketsForServiceDeskTeamRail(searched, deskTeamIds);
    const filtered = applyServiceDeskTableFilters(pool, tableFilters);
    return sortServiceDeskTable(filtered, tableFilters.sort);
  }, [localTickets, search, tableFilters, queue, deskTeamIds]);

  /** All open tickets per group — badge + click shows full group (not only desk-rail subset). */
  const ticketsByTeam = useMemo(
    () => buildOpenAssignedTicketsByTeamMap(localTickets),
    [localTickets],
  );

  const handleSelectTeam = useCallback((teamId: string | null) => {
    setSelectedTeamId(teamId);
    if (teamId) {
      setQueue("teams");
    }
  }, []);

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

  const deskCount = useMemo(
    () => filterByServiceDeskQueue(localTickets, "desk", deskTeamIds).length,
    [localTickets, deskTeamIds],
  );
  const overdueDesk = useMemo(
    () =>
      filterByServiceDeskQueue(localTickets, "desk", deskTeamIds).filter((t) =>
        Boolean(t.sla_breached),
      ).length,
    [localTickets, deskTeamIds],
  );
  const criticalHighDesk = useMemo(
    () =>
      filterByServiceDeskQueue(localTickets, "desk", deskTeamIds).filter((t) =>
        ["critical", "high"].includes(t.priority),
      ).length,
    [localTickets, deskTeamIds],
  );

  const queueTabCounts = useMemo(
    () => ({
      all: filterByServiceDeskQueue(localTickets, "all", deskTeamIds).length,
      desk: deskCount,
      teams: filterByServiceDeskQueue(localTickets, "teams", deskTeamIds).length,
    }),
    [localTickets, deskTeamIds, deskCount],
  );

  const scrollToQueue = useCallback(() => {
    document.getElementById("service-desk-queue")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const drillDeskQueue = useCallback(
    (patch: Partial<ServiceDeskTableFilters>) => {
      setQueue("desk");
      setTableFilters({
        ...DEFAULT_SERVICE_DESK_TABLE_FILTERS,
        ...patch,
      });
      setOffset(0);
      scrollToQueue();
    },
    [scrollToQueue],
  );

  const total = tableTickets.length;
  const rangeEnd = Math.min(offset + PAGE_SIZE, total);

  const resolveTicketForDrop = useCallback(
    (ticketId: string) =>
      pageTickets.find((t) => t.id === ticketId) ??
      tableTickets.find((t) => t.id === ticketId) ??
      localTickets.find((t) => t.id === ticketId),
    [pageTickets, tableTickets, localTickets],
  );

  const handleDragOverTeam = useCallback((teamId: string, event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverTeamId(teamId);
  }, []);

  const handleDragLeaveTeam = useCallback(() => {
    setDragOverTeamId(null);
  }, []);

  const handleDropTeam = useCallback(
    (team: Team) => (event: React.DragEvent) => {
      event.preventDefault();
      setDragOverTeamId(null);
      const ticketId = readDraggedTicketId(event.dataTransfer);
      if (!ticketId) {
        return;
      }
      const ticket = resolveTicketForDrop(ticketId);
      if (!ticket) {
        return;
      }
      setPending({
        ticketId,
        ticketTitle: ticket.title,
        teamId: team.id,
        teamName: team.name,
        confidence: routingConfidenceForTeamAssign(ticket, team.id, internalTeams),
        routingReasonDa: ticket.routing?.routing_reason_da,
      });
    },
    [resolveTicketForDrop, internalTeams],
  );

  async function confirmAssignment(data: {
    teamId: string;
    reason: string;
    faultDisplayed: boolean;
  }) {
    if (!pending) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const detail = await apiPatch<TicketDetail>(
        `/api/v1/tickets/${pending.ticketId}/assignment`,
        {
          assigned_team_id: data.teamId,
          assigned_user_id: null,
          assignment_reason: data.reason,
          fault_displayed: data.faultDisplayed,
        },
      );
      const teamName =
        detail.assigned_team_name ??
        pending.teamName ??
        railTeams.find((t) => t.id === data.teamId)?.name ??
        null;
      const assignmentPatch = {
        ...detail,
        assigned_team_name: teamName,
      };
      setLocalTickets((prev) =>
        mergeTicketAssignmentInList(prev, pending.ticketId, assignmentPatch),
      );
      setPending(null);
      setSelectedTeamId(data.teamId);
      setQueue("teams");
      dispatchBoardTicketsChanged();
      await refreshNow();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke tildele sagen");
    } finally {
      setIsSaving(false);
    }
  }

  const queueHint =
    queue === "teams"
      ? groupsRailOpen
        ? "Sager tildelt en gruppe vises i sagsdeling (bund) og til højre."
        : "Sager tildelt en gruppe vises i sagsdeling (bund) — interne grupper er skjult."
      : groupsRailOpen
        ? "Venstre liste: sager uden gruppe eller på SF Service Desk. Træk til sagsdeling (bund) eller til højre."
        : "Venstre liste: sager uden gruppe eller på SF Service Desk. Træk til sagsdeling (bund).";

  const teamsEmptyHint = groupsRailOpen
    ? "Ingen sager i kø-tabellen — se tildelte sager under interne grupper til højre"
    : "Ingen sager i kø-tabellen — se tildelte sager i sagsdeling (bund)";

  const selectedTeamHint = groupsRailOpen
    ? "Klik gruppen igen for at lukke — eller se listen til højre"
    : "Klik gruppen igen for at lukke — eller åbn interne grupper til højre";

  const queueSection = (
    <section
      id="service-desk-queue"
      className={cn(
        "flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden",
        !groupsRailOpen && "flex-1",
      )}
    >
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Kø-filter">
          {QUEUE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={queue === tab.id}
              className={cn(
                "rounded-[2px] border px-3 py-1.5 text-xs font-semibold transition-colors",
                queue === tab.id
                  ? "border-star-navy bg-star-navy text-white"
                  : "border-[var(--gray-border)] bg-card text-[var(--star-text)] hover:bg-[var(--gray-bg)]",
              )}
              onClick={() => {
                setQueue(tab.id);
                setOffset(0);
                scrollToQueue();
              }}
            >
              {tab.label}{" "}
              <span className="tabular-nums opacity-90">({queueTabCounts[tab.id]})</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TicketSearchInput value={search} onChange={setSearch} id="service-desk-search" />
          <ClearFiltersButton
            visible={columnFiltersActive}
            onClick={() => {
              setTableFilters(DEFAULT_SERVICE_DESK_TABLE_FILTERS);
              setOffset(0);
            }}
          />
        </div>
      </div>

      <p className="text-muted-foreground shrink-0 text-xs">{queueHint}</p>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {queue === "teams" && tableTickets.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            {teamsEmptyHint}
            {railTeamTickets.length > 0
              ? ` (${railTeamTickets.length} matcher filtrene).`
              : "."}
          </p>
        ) : null}
        <WireframeTicketTable
          tickets={pageTickets}
          showTeamColumn
          draggable={queue !== "teams" && tableTickets.length > 0}
          onDragStart={(ticket) => {
            draggingTicketRef.current = ticket;
            setDraggingTicket(ticket);
          }}
          onDragEnd={() => {
            window.setTimeout(() => {
              draggingTicketRef.current = null;
              setDraggingTicket(null);
            }, 0);
          }}
          onRowClick={(ticket) => {
            setSelectedTicket(ticket);
            document.getElementById("dispatch-panel")?.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            });
          }}
          columnFilters={
            <TicketTableColumnFilters
              filters={tableFilters}
              options={filterOptions}
              showTeamColumn
              onChange={(patch) => {
                setTableFilters((prev) => ({ ...prev, ...patch }));
                setOffset(0);
              }}
            />
          }
        />
      </div>

      <div className="flex shrink-0 flex-col items-center justify-between gap-2 sm:flex-row">
        <p className="text-muted-foreground text-xs">
          Viser {total === 0 ? 0 : offset + 1}–{rangeEnd} af{" "}
          <button
            type="button"
            className="text-star-navy font-semibold hover:underline"
            onClick={scrollToQueue}
            aria-label={`${total} sager i køen`}
          >
            {total}
          </button>
        </p>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={offset <= 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            ‹ Forrige
          </Button>
          {PAGE_OFFSETS.map((o) => (
            <Button
              key={o}
              type="button"
              size="sm"
              variant={offset === o ? "default" : "outline"}
              className={offset === o ? "bg-star-navy" : ""}
              disabled={o >= total && o > 0}
              onClick={() => setOffset(o)}
            >
              {o}–{o + PAGE_SIZE}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Næste ›
          </Button>
        </div>
      </div>

      {selectedTeam && selectedTeamTickets.length > 0 ? (
        <div className="wire-card mb-3 max-h-48 shrink-0 overflow-hidden">
          <div className="border-b border-[var(--gray-border)] px-3 py-2">
            <p className="text-star-navy text-xs font-bold">
              {selectedTeam.name} — {selectedTeamTickets.length} sager
            </p>
            <p className="text-muted-foreground text-[10px]">{selectedTeamHint}</p>
          </div>
          <ul className="max-h-36 overflow-y-auto px-3 py-2">
            {selectedTeamTickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/tickets/${ticket.id}`}
                  className="text-star-navy hover:text-star-blue block truncate py-0.5 text-[11px] font-medium"
                >
                  <span className="font-mono">{ticket.ticket_number}</span>
                  <span className="text-muted-foreground ml-1">{ticket.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-muted-foreground mt-2 shrink-0 text-center text-[11px]">
        Grib en sag og træk den til sagsdeling (bund) — bereder-stregen viser AI-match mens du
        trækker
      </p>
    </section>
  );

  const groupsRail = (
    <DispatchTeamsRail
      teams={railTeams}
      ticketsByTeam={ticketsByTeam}
      dragOverTeamId={dragOverTeamId}
      onDragOverTeam={handleDragOverTeam}
      onDragLeaveTeam={handleDragLeaveTeam}
      onDropTeam={handleDropTeam}
      selectedTeamId={selectedTeamId}
      onSelectTeam={handleSelectTeam}
      title="Interne grupper"
      description="Fold grupper ud/luk med pil — træk sag til bereder-streg når gruppen er åben"
      panelOpen={groupsRailOpen}
      onTogglePanel={toggleGroupsRail}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="wire-scroll-content min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
      <header className="shrink-0">
        <h1 className="text-foreground text-2xl font-bold tracking-tight">Service Desk</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Kø og fordeling — træk en sag til sagsdeling i bunden (▼/▲) eller til interne
          grupper til højre (▼ i panelhovedet).
        </p>
        {syncError ? (
          <p className="text-star-red mt-2 text-sm" role="alert">
            {syncError}
          </p>
        ) : null}
      </header>

      <div className="grid shrink-0 gap-3 md:grid-cols-3">
        <div className="wire-card flex min-h-[140px] flex-col justify-center py-4">
          <Gauge
            label="I service desk"
            value={deskCount}
            max={Math.max(deskCount, 1)}
            accent="navy"
            hint="Åbne sager uden gruppe eller på SF Service Desk"
            onClick={() => drillDeskQueue({})}
          />
        </div>
        <div className="wire-card flex min-h-[140px] flex-col justify-center py-4">
          <Gauge
            label="SLA overskredet (kø)"
            value={overdueDesk}
            max={Math.max(deskCount, 1)}
            accent="red"
            hint="Sager i desk-kø med brudt SLA"
            onClick={() => drillDeskQueue({ sla: "breached" })}
          />
        </div>
        <div className="wire-card flex min-h-[140px] flex-col justify-center py-4">
          <Gauge
            label="Kritisk + høj (kø)"
            value={criticalHighDesk}
            max={Math.max(deskCount, 1)}
            accent="blue"
            hint="P1/P2 i service desk"
            onClick={() => drillDeskQueue({ priorityTier: "critical_high" })}
          />
        </div>
      </div>

      {groupsRailOpen ? (
        <ResizableSplit
          storageKey="stardesk-service-desk-split"
          defaultSizes={[68, 32]}
          minSizes={[45, 24]}
          className="min-h-0 flex-1 gap-0"
        >
          {queueSection}
          {groupsRail}
        </ResizableSplit>
      ) : (
        <div className="flex min-h-0 flex-1 gap-0">
          {queueSection}
          <Button
            type="button"
            variant="outline"
            className="border-star-red/40 text-star-navy hover:bg-star-blue-light/60 flex h-auto w-11 shrink-0 flex-col gap-2 self-stretch rounded-none border-l-[3px] border-y-0 border-r-0 px-1 py-4 text-[10px] font-bold tracking-wide uppercase"
            onClick={toggleGroupsRail}
            aria-label="Vis interne grupper"
            title="Vis interne grupper"
          >
            <span className="text-base leading-none" aria-hidden>
              ◀
            </span>
            <span className="[writing-mode:vertical-rl] rotate-180">Vis grupper</span>
          </Button>
        </div>
      )}

      {error ? (
        <p className="text-destructive shrink-0 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {pending ? (
        <AssignmentDropDialog
          ticketTitle={pending.ticketTitle}
          teamName={pending.teamName}
          teamId={pending.teamId}
          teams={internalTeams}
          confidence={pending.confidence}
          routingReasonDa={pending.routingReasonDa}
          onConfirm={confirmAssignment}
          onCancel={() => !isSaving && setPending(null)}
        />
      ) : null}
      </div>

      <AgentBottomPanel
        tickets={localTickets}
        teams={internalTeams}
        selectedTicket={selectedTicket}
        draggingTicket={draggingTicket}
        onTicketAssigned={handleTicketAssigned}
        teamsTabLabel="Sagsdeling"
      />
    </div>
  );
}
