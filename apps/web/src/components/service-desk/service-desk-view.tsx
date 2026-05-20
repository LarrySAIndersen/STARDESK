"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { TicketSearchInput } from "@/components/ticket-search-input";
import { WireframeTicketTable } from "@/components/wireframe/wireframe-ticket-table";
import { Button } from "@/components/ui/button";
import { ticketMatchesSearch } from "@/lib/ticket-tags";
import {
  filterByServiceDeskQueue,
  isInServiceDeskQueue,
  paginateTickets,
  sortServiceDeskQueue,
  type ServiceDeskQueueFilter,
} from "@/lib/service-desk-queue";
import { cn } from "@/lib/utils";
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

export function ServiceDeskView({ tickets }: { tickets: Ticket[] }) {
  const [queue, setQueue] = useState<ServiceDeskQueueFilter>("desk");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);

  const filtered = useMemo(() => {
    const q = filterByServiceDeskQueue(tickets, queue);
    const searched = q.filter((t) => ticketMatchesSearch(t, search));
    return sortServiceDeskQueue(searched);
  }, [tickets, queue, search]);

  const pageTickets = useMemo(
    () => paginateTickets(filtered, offset, PAGE_SIZE),
    [filtered, offset],
  );

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

  const total = filtered.length;
  const rangeEnd = Math.min(offset + PAGE_SIZE, total);

  return (
    <div className="wire-scroll-content space-y-4 px-4 py-4">
      <header>
        <h1 className="text-star-navy text-2xl font-bold tracking-tight">Service Desk</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Kø, fordeling og overblik over åbne sager — sorteret med ikke-distribuerede og høj
          prioritet først.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
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

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
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

      <WireframeTicketTable tickets={pageTickets} />

      <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
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

      <p className="text-center text-[11px] text-[var(--gray-mid)]">
        Ikke-distribuerede sager (
        {tickets.filter(isInServiceDeskQueue).length} i desk-logik) vises først, derefter
        kritisk/høj prioritet og ældste henvendelser.
      </p>
    </div>
  );
}
