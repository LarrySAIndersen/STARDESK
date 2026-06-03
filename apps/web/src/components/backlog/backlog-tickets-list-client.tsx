"use client";

import { useMemo, useState } from "react";

import { ClearFiltersButton } from "@/components/clear-filters-button";
import {
  DEFAULT_TICKET_FIELD_FILTERS,
  TicketFieldFilterPanel,
} from "@/components/backlog/ticket-field-filter-panel";
import { WireframeTicketTable } from "@/components/wireframe/wireframe-ticket-table";
import {
  applyTicketFieldFilters,
  hasActiveTicketFieldFilters,
  type TicketFieldFilters,
} from "@/lib/ticket-field-filters";
import {
  sortServiceDeskTable,
  type ServiceDeskSortKey,
} from "@/lib/service-desk-table-filters";
import type { Ticket } from "@/types/ticket";

const DESK_SORT_KEYS = new Set<string>([
  "queue",
  "ticket_number_asc",
  "ticket_number_desc",
  "title_asc",
  "title_desc",
  "source_asc",
  "category_asc",
  "status_asc",
  "priority_asc",
  "priority_desc",
  "sla_asc",
  "sla_desc",
  "created_desc",
  "created_asc",
]);

function sortBacklogTickets(tickets: Ticket[], sort: string): Ticket[] {
  if (sort === "updated_desc") {
    return [...tickets].sort(
      (a, b) =>
        new Date(b.updated_at ?? b.created_at).getTime() -
        new Date(a.updated_at ?? a.created_at).getTime(),
    );
  }
  if (sort === "updated_asc") {
    return [...tickets].sort(
      (a, b) =>
        new Date(a.updated_at ?? a.created_at).getTime() -
        new Date(b.updated_at ?? b.created_at).getTime(),
    );
  }
  const deskSort: ServiceDeskSortKey = DESK_SORT_KEYS.has(sort)
    ? (sort as ServiceDeskSortKey)
    : "sla_asc";
  return sortServiceDeskTable(tickets, deskSort);
}

export function BacklogTicketsListClient({
  tickets,
  currentUserId,
}: {
  tickets: Ticket[];
  currentUserId?: string;
}) {
  const [filters, setFilters] = useState<TicketFieldFilters>(DEFAULT_TICKET_FIELD_FILTERS);
  const [panelOpen, setPanelOpen] = useState(true);

  const patchFilters = (patch: Partial<TicketFieldFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const filtered = useMemo(() => {
    const narrowed = applyTicketFieldFilters(tickets, filters, { currentUserId });
    return sortBacklogTickets(narrowed, filters.sort);
  }, [tickets, filters, currentUserId]);

  const hasActiveFilters = hasActiveTicketFieldFilters(filters);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="wire-btn wire-btn-sm"
          onClick={() => setPanelOpen((open) => !open)}
          aria-expanded={panelOpen}
        >
          {panelOpen ? "Skjul filtre" : "Vis alle filtre"}
        </button>
        <span className="text-muted-foreground text-xs">
          {filtered.length} sag{filtered.length === 1 ? "" : "er"}
        </span>
        <ClearFiltersButton
          onClick={() => setFilters(DEFAULT_TICKET_FIELD_FILTERS)}
          visible={hasActiveFilters}
        />
      </div>

      {panelOpen ? (
        <TicketFieldFilterPanel tickets={tickets} filters={filters} onChange={patchFilters} />
      ) : null}

      <WireframeTicketTable tickets={filtered} />
    </div>
  );
}
