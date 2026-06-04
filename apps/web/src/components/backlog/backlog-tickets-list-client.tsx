"use client";

import { useMemo, useState } from "react";

import {
  DEFAULT_TICKET_FIELD_FILTERS,
  TicketFieldFilterPanel,
} from "@/components/backlog/ticket-field-filter-panel";
import { ClearFiltersButton } from "@/components/clear-filters-button";
import {
  collectServiceDeskFilterOptions,
  TicketTableColumnFilters,
} from "@/components/service-desk/ticket-table-column-filters";
import { TicketSearchInput } from "@/components/ticket-search-input";
import { WireframeTicketTable } from "@/components/wireframe/wireframe-ticket-table";
import {
  applyBacklogTableFilters,
  DEFAULT_BACKLOG_TABLE_FILTERS,
  hasActiveBacklogTableFilters,
  type BacklogTableFilters,
} from "@/lib/backlog-table-filters";
import {
  sortServiceDeskTable,
  type ServiceDeskSortKey,
} from "@/lib/service-desk-table-filters";
import {
  applyTicketFieldFilters,
  hasActiveTicketFieldFilters,
  type TicketFieldFilters,
} from "@/lib/ticket-field-filters";
import { ticketTypeLabel } from "@/lib/ticket-labels";
import { ticketMatchesSearch } from "@/lib/ticket-tags";
import type { Ticket } from "@/types/ticket";

const TICKET_TYPE_OPTIONS = ["", "incident", "service_request", "problem"] as const;

const ASSIGNMENT_OPTIONS: {
  value: BacklogTableFilters["assignment"];
  label: string;
}[] = [
  { value: "", label: "Alle tildelinger" },
  { value: "mine", label: "Tildelt mig" },
  { value: "unassigned", label: "Uden agent" },
];

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
  const [search, setSearch] = useState("");
  const [fieldFilters, setFieldFilters] = useState<TicketFieldFilters>(DEFAULT_TICKET_FIELD_FILTERS);
  const [tableFilters, setTableFilters] = useState<BacklogTableFilters>(DEFAULT_BACKLOG_TABLE_FILTERS);
  const [panelOpen, setPanelOpen] = useState(true);

  const patchFieldFilters = (patch: Partial<TicketFieldFilters>) => {
    setFieldFilters((prev) => ({ ...prev, ...patch }));
  };

  const patchTableFilters = (patch: Partial<BacklogTableFilters>) => {
    setTableFilters((prev) => ({ ...prev, ...patch }));
  };

  const filtered = useMemo(() => {
    const searched = tickets.filter((t) => ticketMatchesSearch(t, search));
    const fieldFiltered = applyTicketFieldFilters(searched, fieldFilters, { currentUserId });
    const narrowed = applyBacklogTableFilters(fieldFiltered, tableFilters, currentUserId);
    const sortKey =
      tableFilters.sort !== DEFAULT_BACKLOG_TABLE_FILTERS.sort
        ? tableFilters.sort
        : fieldFilters.sort;
    return sortBacklogTickets(narrowed, sortKey);
  }, [tickets, search, fieldFilters, tableFilters, currentUserId]);

  const filterOptions = useMemo(() => collectServiceDeskFilterOptions(tickets), [tickets]);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    hasActiveTicketFieldFilters(fieldFilters) ||
    hasActiveBacklogTableFilters(tableFilters);

  const clearAllFilters = () => {
    setSearch("");
    setFieldFilters(DEFAULT_TICKET_FIELD_FILTERS);
    setTableFilters(DEFAULT_BACKLOG_TABLE_FILTERS);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="wire-form-input h-8 w-auto min-w-[9rem] text-xs"
          value={tableFilters.assignment}
          onChange={(e) =>
            patchTableFilters({
              assignment: e.target.value as BacklogTableFilters["assignment"],
            })
          }
          aria-label="Filtrer tildeling"
        >
          {ASSIGNMENT_OPTIONS.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          className="wire-form-input h-8 w-auto min-w-[8.5rem] text-xs"
          value={tableFilters.ticket_type}
          onChange={(e) =>
            patchTableFilters({
              ticket_type: e.target.value as BacklogTableFilters["ticket_type"],
            })
          }
          aria-label="Filtrer sagstype"
        >
          <option value="">Alle typer</option>
          {TICKET_TYPE_OPTIONS.filter(Boolean).map((type) => (
            <option key={type} value={type}>
              {ticketTypeLabel(type)}
            </option>
          ))}
        </select>
        <TicketSearchInput value={search} onChange={setSearch} />
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
        <ClearFiltersButton onClick={clearAllFilters} visible={hasActiveFilters} />
      </div>

      {panelOpen ? (
        <TicketFieldFilterPanel
          tickets={tickets}
          filters={fieldFilters}
          onChange={patchFieldFilters}
        />
      ) : null}

      <WireframeTicketTable
        tickets={filtered}
        columnFilters={
          <TicketTableColumnFilters
            filters={tableFilters}
            onChange={patchTableFilters}
            options={filterOptions}
          />
        }
      />
    </div>
  );
}
