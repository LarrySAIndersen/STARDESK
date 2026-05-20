"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { AssignmentDropDialog } from "@/components/assignment-drop-dialog";
import { DispatchTeamsRail } from "@/components/dispatch/dispatch-teams-rail";
import { TicketSearchInput } from "@/components/ticket-search-input";
import { ResizableSplit } from "@/components/ui/resizable-split";
import { WireframeTicketTable } from "@/components/wireframe/wireframe-ticket-table";
import { Button } from "@/components/ui/button";
import { apiPatch } from "@/lib/api";
import { partitionTeamsByCategory, sortTeamsForDisplay } from "@/lib/team-categories";
import { readDraggedTicketId } from "@/lib/ticket-drag";
import { ticketMatchesSearch } from "@/lib/ticket-tags";
import {
  filterByServiceDeskQueue,
  paginateTickets,
  sortServiceDeskQueue,
  type ServiceDeskQueueFilter,
} from "@/lib/service-desk-queue";
import { cn } from "@/lib/utils";
import type { Team } from "@/types/team";
import type { Ticket } from "@/types/ticket";

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

type PendingDrop = {
  ticketId: string;
  ticketTitle: string;
  teamId?: string;
  teamName?: string;
};

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
  const [offset, setOffset] = useState(0);
  const [dragOverTeamId, setDragOverTeamId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingDrop | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const internalTeams = useMemo(() => {
    const { internal } = partitionTeamsByCategory(teams);
    return sortTeamsForDisplay(internal);
  }, [teams]);

  const openTickets = useMemo(() => {
    const q = filterByServiceDeskQueue(tickets, queue);
    const searched = q.filter((t) => ticketMatchesSearch(t, search));
    return sortServiceDeskQueue(searched);
  }, [tickets, queue, search]);

  const pageTickets = useMemo(
    () => paginateTickets(openTickets, offset, PAGE_SIZE),
    [openTickets, offset],
  );

  const ticketsByTeam = useMemo(() => buildTicketsByTeam(openTickets), [openTickets]);

  const deskCount = useMemo(
    () => filterByServiceDeskQueue(tickets, "desk").length,
    [tickets],
  );
  const overdueDesk = useMemo(
    () =>
      filterByServiceDeskQueue(tickets, "desk").filter((t) => Boolean(t.sla_breached))
        .length,
    [tickets],
  );
  const criticalHighDesk = useMemo(
    () =>
      filterByServiceDeskQueue(tickets, "desk").filter((t) =>
        ["critical", "high"].includes(t.priority),
      ).length,
    [tickets],
  );

  const total = openTickets.length;
  const rangeEnd = Math.min(offset + PAGE_SIZE, total);

  const resolveTicketForDrop = useCallback(
    (ticketId: string) => openTickets.find((t) => t.id === ticketId),
    [openTickets],
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
      await apiPatch(`/api/v1/tickets/${pending.ticketId}/assignment`, {
        assigned_team_id: data.teamId,
        assigned_user_id: null,
        assignment_reason: data.reason,
        fault_displayed: data.faultDisplayed,
      });
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
            hint="Åbne sager i kø eller på SF Service Desk"
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
            <TicketSearchInput value={search} onChange={setSearch} id="service-desk-search" />
          </div>

          <p className="text-muted-foreground shrink-0 text-xs">
            Træk en sag fra listen og slip den på en gruppe til højre. Sager i den aktive
            filtrering kan tildeles.
          </p>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <WireframeTicketTable tickets={pageTickets} draggable />
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
          teams={internalTeams}
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
