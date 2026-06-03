"use client";

import { useMemo, useState } from "react";

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
import { sortServiceDeskTable } from "@/lib/service-desk-table-filters";
import { ticketMatchesSearch } from "@/lib/ticket-tags";
import { ticketTypeLabel } from "@/lib/ticket-labels";
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

export function BacklogTicketsListClient({
  tickets,
  currentUserId,
}: {
  tickets: Ticket[];
  currentUserId?: string;
}) {
  const [search, setSearch] = useState("");
  const [tableFilters, setTableFilters] = useState<BacklogTableFilters>(
    DEFAULT_BACKLOG_TABLE_FILTERS,
  );

  const patchFilters = (patch: Partial<BacklogTableFilters>) => {
    setTableFilters((prev) => ({ ...prev, ...patch }));
  };

  const filtered = useMemo(() => {
    const searched = tickets.filter((t) => ticketMatchesSearch(t, search));
    const narrowed = applyBacklogTableFilters(searched, tableFilters, currentUserId);
    return sortServiceDeskTable(narrowed, tableFilters.sort);
  }, [tickets, search, tableFilters, currentUserId]);

  const filterOptions = useMemo(
    () => collectServiceDeskFilterOptions(tickets),
    [tickets],
  );

  const hasActiveFilters =
    Boolean(search.trim()) || hasActiveBacklogTableFilters(tableFilters);

  const clearAllFilters = () => {
    setSearch("");
    setTableFilters(DEFAULT_BACKLOG_TABLE_FILTERS);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="wire-form-input h-8 w-auto min-w-[9rem] text-xs"
          value={tableFilters.assignment}
          onChange={(e) =>
            patchFilters({
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
            patchFilters({
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
        <span className="text-muted-foreground text-xs">
          {filtered.length} sag{filtered.length === 1 ? "" : "er"}
        </span>
        <ClearFiltersButton onClick={clearAllFilters} visible={hasActiveFilters} />
      </div>

      <WireframeTicketTable
        tickets={filtered}
        columnFilters={
          <TicketTableColumnFilters
            filters={tableFilters}
            onChange={patchFilters}
            options={filterOptions}
          />
        }
      />
    </div>
  );
}
