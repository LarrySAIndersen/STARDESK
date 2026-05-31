"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  mergeTicketAssignmentInList,
  reconcileLocalTicketsWithServer,
} from "@/lib/ticket-assignment";
import { partitionTeamsByCategory, sortTeamsForDisplay } from "@/lib/team-categories";
import { readDraggedTicketId } from "@/lib/ticket-drag";
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
}>;

function buildTicketsByTeam(openTickets: Ticket[]): Map<string, Ticket[]> {
  const map = new Map<string, Ticket[]>();
  for (const ticket of openTickets) {
    if (ticket.assigned_team_id) {
      const list = map.get(ticket.assigned_team_id) ?? [];
      list.push(ticket);
      map.set(ticket.assigned_team_id, list);
    }
  }
  for (const [teamId, list] of map) {
    list.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    map.set(teamId, list);
  }
  return map;
}

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
  const [pending, setPending] = useState<PendingDrop | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [localTickets, setLocalTickets] = useState<Ticket[]>(tickets);

  useEffect(() => {
    setLocalTickets((prev) => reconcileLocalTicketsWithServer(prev, tickets));
  }, [tickets]);

  const internalTeams = useMemo(() => {
    const { internal } = partitionTeamsByCategory(teams);
    return sortTeamsForDisplay(internal);
  }, [teams]);

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

  const ticketsByTeam = useMemo(
    () => buildTicketsByTeam(railTeamTickets),
    [railTeamTickets],
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

  const total = tableTickets.length;
  const rangeEnd = Math.min(offset + PAGE_SIZE, total);

  const resolveTicketForDrop = useCallback(
    (ticketId: string) => tableTickets.find((t) => t.id === ticketId),
    [tableTickets],
  );

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
      });
    },
    [resolveTicketForDrop],
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
      setLocalTickets((prev) =>
        mergeTicketAssignmentInList(prev, pending.ticketId, detail),
      );
      setPending(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke tildele sagen");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="wire-scroll-content flex min-h-0 flex-1 flex-col space-y-4 px-4 py-4">
      <header className="shrink-0">
        <h1 className="text-star-navy text-2xl font-bold tracking-tight">Service Desk</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Kø, fordeling og overblik over åbne sager — træk en sag til en intern gruppe til
          højre (som på dashboard).
        </p>
      </header>

      <div className="grid shrink-0 gap-3 md:grid-cols-3">
        <div className="wire-card flex min-h-[140px] flex-col justify-center py-4">
          <Gauge
            label="I service desk"
            value={deskCount}
            max={Math.max(deskCount, 1)}
            accent="navy"
            hint="Åbne sager uden gruppe eller på SF Service Desk"
          />
        </div>
        <div className="wire-card flex min-h-[140px] flex-col justify-center py-4">
          <Gauge
            label="SLA overskredet (kø)"
            value={overdueDesk}
            max={Math.max(deskCount, 1)}
            accent="red"
            hint="Sager i desk-kø med brudt SLA"
          />
        </div>
        <div className="wire-card flex min-h-[140px] flex-col justify-center py-4">
          <Gauge
            label="Kritisk + høj (kø)"
            value={criticalHighDesk}
            max={Math.max(deskCount, 1)}
            accent="blue"
            hint="P1/P2 i service desk"
          />
        </div>
      </div>

      <ResizableSplit
        storageKey="stardesk-service-desk-split"
        defaultSizes={[68, 32]}
        minSizes={[45, 24]}
        className="min-h-0 flex-1 gap-0"
      >
        <section className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
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
                      : "border-[var(--gray-border)] bg-white text-[var(--star-text)] hover:bg-[var(--gray-bg)]",
                  )}
                  onClick={() => {
                    setQueue(tab.id);
                    setOffset(0);
                  }}
                >
                  {tab.label}
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

          <p className="text-muted-foreground shrink-0 text-xs">
            {queue === "teams"
              ? "Sager tildelt en gruppe vises kun under den pågældende gruppe til højre."
              : "Venstre liste: sager uden gruppe eller på SF Service Desk. Træk til en anden gruppe — sagen forsvinder her og vises under gruppen til højre."}
          </p>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {queue === "teams" && tableTickets.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Ingen sager i kø-tabellen — se tildelte sager under interne grupper til højre
                {railTeamTickets.length > 0
                  ? ` (${railTeamTickets.length} matcher filtrene).`
                  : "."}
              </p>
            ) : null}
            <WireframeTicketTable
              tickets={pageTickets}
              draggable={queue !== "teams" && tableTickets.length > 0}
              columnFilters={
                <TicketTableColumnFilters
                  filters={tableFilters}
                  options={filterOptions}
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
              Viser {total === 0 ? 0 : offset + 1}–{rangeEnd} af {total}
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
        </section>

        <DispatchTeamsRail
          teams={railTeams}
          ticketsByTeam={ticketsByTeam}
          dragOverTeamId={dragOverTeamId}
          onDragOverTeam={(teamId, event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setDragOverTeamId(teamId);
          }}
          onDragLeaveTeam={() => setDragOverTeamId(null)}
          onDropTeam={handleDropTeam}
          title="Interne grupper"
          description="Slip en sag her — begrund tildeling i dialogen"
        />
      </ResizableSplit>

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
          onConfirm={confirmAssignment}
          onCancel={() => !isSaving && setPending(null)}
        />
      ) : null}
    </div>
  );
}
