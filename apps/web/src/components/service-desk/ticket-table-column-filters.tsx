"use client";

import { priorityLabel, statusLabel } from "@/lib/ticket-labels";
import {
  ticketSourceFilterLabel,
  type ServiceDeskTableFilters,
} from "@/lib/service-desk-table-filters";
import type { Ticket } from "@/types/ticket";

const selectClassName =
  "h-7 w-full min-w-0 rounded-[2px] border-0 bg-white/15 px-1.5 text-[10px] font-semibold text-white outline-none focus:bg-white/25 focus:ring-1 focus:ring-white/40";

const SORT_OPTIONS: { value: ServiceDeskTableFilters["sort"]; label: string }[] = [
  { value: "queue", label: "Kø (standard)" },
  { value: "ticket_number_asc", label: "Sagsnr ↑" },
  { value: "ticket_number_desc", label: "Sagsnr ↓" },
  { value: "title_asc", label: "Titel A–Å" },
  { value: "title_desc", label: "Titel Å–A" },
  { value: "source_asc", label: "Kilde A–Å" },
  { value: "category_asc", label: "Kategori A–Å" },
  { value: "status_asc", label: "Status A–Å" },
  { value: "priority_asc", label: "Prioritet ↑" },
  { value: "priority_desc", label: "Prioritet ↓" },
  { value: "sla_asc", label: "SLA (mindst tid)" },
  { value: "sla_desc", label: "SLA (mest tid)" },
  { value: "created_desc", label: "Nyeste" },
  { value: "created_asc", label: "Ældste" },
];

const PRIORITY_OPTIONS = ["", "critical", "high", "medium", "low"] as const;

export function collectServiceDeskFilterOptions(tickets: Ticket[]) {
  const categories = new Set<string>();
  const tags = new Set<string>();
  const sources = new Set<string>();
  const statuses = new Set<string>();

  for (const ticket of tickets) {
    if (ticket.category_name_da) {
      categories.add(ticket.category_name_da);
    }
    for (const tag of ticket.tags ?? []) {
      tags.add(tag);
    }
    sources.add(ticket.source?.trim() || "other");
    statuses.add(ticket.status);
  }

  return {
    categories: [...categories].sort((a, b) => a.localeCompare(b, "da")),
    tags: [...tags].sort((a, b) => a.localeCompare(b, "da")),
    sources: [...sources].sort((a, b) =>
      ticketSourceFilterLabel(a).localeCompare(ticketSourceFilterLabel(b), "da"),
    ),
    statuses: [...statuses].sort((a, b) =>
      statusLabel(a).localeCompare(statusLabel(b), "da"),
    ),
  };
}

export function TicketTableColumnFilters({
  filters,
  onChange,
  options,
}: {
  filters: ServiceDeskTableFilters;
  onChange: (patch: Partial<ServiceDeskTableFilters>) => void;
  options: ReturnType<typeof collectServiceDeskFilterOptions>;
}) {
  return (
    <div
      className="wire-table-head wire-table-grid-tickets min-h-9 items-stretch py-1"
      role="row"
      aria-label="Filtrer og sorter sager"
    >
      <label className="flex min-w-0 flex-col justify-center gap-0.5">
        <span className="text-[9px] font-bold tracking-wide uppercase opacity-80">Sagsnr</span>
        <select
          className={selectClassName}
          value={filters.sort}
          onChange={(e) =>
            onChange({ sort: e.target.value as ServiceDeskTableFilters["sort"] })
          }
          aria-label="Sorter efter sagsnr og kø"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="text-star-navy">
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-0 flex-col justify-center gap-0.5">
        <span className="text-[9px] font-bold tracking-wide uppercase opacity-80">
          Titel og tags
        </span>
        <select
          className={selectClassName}
          value={filters.tag}
          onChange={(e) => onChange({ tag: e.target.value })}
          aria-label="Filtrer tag"
        >
          <option value="" className="text-star-navy">
            Alle tags
          </option>
          {options.tags.map((tag) => (
            <option key={tag} value={tag} className="text-star-navy">
              {tag}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-0 flex-col justify-center gap-0.5">
        <span className="text-[9px] font-bold tracking-wide uppercase opacity-80">Kilde</span>
        <select
          className={selectClassName}
          value={filters.source}
          onChange={(e) => onChange({ source: e.target.value })}
          aria-label="Filtrer kilde"
        >
          <option value="" className="text-star-navy">
            Alle
          </option>
          {options.sources.map((source) => (
            <option key={source} value={source} className="text-star-navy">
              {ticketSourceFilterLabel(source)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-0 flex-col justify-center gap-0.5">
        <span className="text-[9px] font-bold tracking-wide uppercase opacity-80">Kategori</span>
        <select
          className={selectClassName}
          value={filters.category}
          onChange={(e) => onChange({ category: e.target.value })}
          aria-label="Filtrer kategori"
        >
          <option value="" className="text-star-navy">
            Alle
          </option>
          {options.categories.map((category) => (
            <option key={category} value={category} className="text-star-navy">
              {category}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-0 flex-col justify-center gap-0.5">
        <span className="text-[9px] font-bold tracking-wide uppercase opacity-80">Status</span>
        <select
          className={selectClassName}
          value={filters.status}
          onChange={(e) => onChange({ status: e.target.value })}
          aria-label="Filtrer status"
        >
          <option value="" className="text-star-navy">
            Alle
          </option>
          {options.statuses.map((status) => (
            <option key={status} value={status} className="text-star-navy">
              {statusLabel(status)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-0 flex-col justify-center gap-0.5">
        <span className="text-[9px] font-bold tracking-wide uppercase opacity-80">
          Prioritet
        </span>
        <select
          className={selectClassName}
          value={filters.priority}
          onChange={(e) => onChange({ priority: e.target.value })}
          aria-label="Filtrer prioritet"
        >
          <option value="" className="text-star-navy">
            Alle
          </option>
          {PRIORITY_OPTIONS.filter(Boolean).map((priority) => (
            <option key={priority} value={priority} className="text-star-navy">
              {priorityLabel(priority)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-0 flex-col justify-center gap-0.5">
        <span className="text-[9px] font-bold tracking-wide uppercase opacity-80">SLA</span>
        <select
          className={selectClassName}
          value={filters.sla}
          onChange={(e) => onChange({ sla: e.target.value })}
          aria-label="Filtrer SLA"
        >
          <option value="" className="text-star-navy">
            Alle
          </option>
          <option value="breached" className="text-star-navy">
            Overskredet
          </option>
          <option value="ok" className="text-star-navy">
            Inden for SLA
          </option>
        </select>
      </label>
    </div>
  );
}
