"use client";

import { priorityLabel, statusLabel, ticketTypeLabel } from "@/lib/ticket-labels";
import {
  ASSIGNEE_MINE,
  collectTicketFieldFilterOptions,
  DEFAULT_TICKET_FIELD_FILTERS,
  NONE_ASSIGNEE,
  NONE_SUBCATEGORY,
  NONE_TEAM,
  type TicketFieldFilters,
} from "@/lib/ticket-field-filters";
import { ticketSourceLabelDa } from "@/lib/ticket-source-label";
import {
  TICKET_PRIORITY_VALUES,
  TICKET_SOURCE_VALUES,
  TICKET_TYPE_VALUES,
} from "@/lib/metadata-search";
import { TICKET_SORT_OPTIONS } from "@/lib/ticket-sort";
import type { Ticket } from "@/types/ticket";

const inputClass = "wire-form-input h-8 w-full min-w-0 text-xs";
const selectClass = "wire-form-input h-8 w-full min-w-0 text-xs";

const PERIOD_OPTIONS = [
  { value: "", label: "Alle" },
  { value: "today", label: "I dag" },
  { value: "7d", label: "Seneste 7 d" },
  { value: "30d", label: "Seneste 30 d" },
] as const;

const YES_NO_OPTIONS = [
  { value: "", label: "Alle" },
  { value: "yes", label: "Ja" },
  { value: "no", label: "Nej" },
] as const;

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
      <span className="text-muted-foreground text-[11px] font-medium">{label}</span>
      {children}
    </label>
  );
}

export function TicketFieldFilterPanel({
  tickets,
  filters,
  onChange,
}: {
  tickets: Ticket[];
  filters: TicketFieldFilters;
  onChange: (patch: Partial<TicketFieldFilters>) => void;
}) {
  const options = collectTicketFieldFilterOptions(tickets);

  return (
    <div className="wire-card space-y-4 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="wire-card-title mb-0 text-sm">Filtrer sag</p>
        <select
          className={`${selectClass} max-w-[11rem]`}
          value={filters.sort}
          onChange={(e) => onChange({ sort: e.target.value })}
          aria-label="Sorter sager"
        >
          {TICKET_SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
          <option value="updated_desc">Senest opdateret</option>
          <option value="updated_asc">Ældst opdateret</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-3">
        <FilterField label="Sagsnr.">
          <input
            className={inputClass}
            value={filters.ticket_number}
            onChange={(e) => onChange({ ticket_number: e.target.value })}
            placeholder="INC-2026-…"
          />
        </FilterField>
        <FilterField label="Titel">
          <input
            className={inputClass}
            value={filters.title}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </FilterField>
        <FilterField label="Beskrivelse">
          <input
            className={inputClass}
            value={filters.description}
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </FilterField>
      </div>

      <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
        Detaljer
      </p>
      <div className="flex flex-wrap gap-3">
        <FilterField label="Status">
          <select
            className={selectClass}
            value={filters.status}
            onChange={(e) => onChange({ status: e.target.value })}
          >
            <option value="">Alle</option>
            {options.statuses.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Kategori">
          <select
            className={selectClass}
            value={filters.category}
            onChange={(e) => onChange({ category: e.target.value })}
          >
            <option value="">Alle</option>
            {options.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Underkategori">
          <select
            className={selectClass}
            value={filters.subcategory}
            onChange={(e) => onChange({ subcategory: e.target.value })}
          >
            <option value="">Alle</option>
            <option value={NONE_SUBCATEGORY}>Ingen (—)</option>
            {options.subcategories.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Tildelt team">
          <select
            className={selectClass}
            value={filters.assigned_team}
            onChange={(e) => onChange({ assigned_team: e.target.value })}
          >
            <option value="">Alle</option>
            <option value={NONE_TEAM}>Ingen (—)</option>
            {options.teams.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Sagsbehandler">
          <select
            className={selectClass}
            value={filters.assigned_user}
            onChange={(e) => onChange({ assigned_user: e.target.value })}
          >
            <option value="">Alle</option>
            <option value={ASSIGNEE_MINE}>Tildelt mig</option>
            <option value={NONE_ASSIGNEE}>Ingen (—)</option>
            {options.assignees.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Prioritet">
          <select
            className={selectClass}
            value={filters.priority}
            onChange={(e) => onChange({ priority: e.target.value })}
          >
            <option value="">Alle</option>
            {TICKET_PRIORITY_VALUES.map((p) => (
              <option key={p} value={p}>
                {priorityLabel(p)}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Kilde">
          <select
            className={selectClass}
            value={filters.source}
            onChange={(e) => onChange({ source: e.target.value })}
          >
            <option value="">Alle</option>
            {TICKET_SOURCE_VALUES.map((source) => (
              <option key={source} value={source}>
                {ticketSourceLabelDa(source)}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Indmelder">
          <select
            className={selectClass}
            value={filters.reporter}
            onChange={(e) => onChange({ reporter: e.target.value })}
          >
            <option value="">Alle</option>
            {options.reporters.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="SLA">
          <select
            className={selectClass}
            value={filters.sla}
            onChange={(e) =>
              onChange({ sla: e.target.value as TicketFieldFilters["sla"] })
            }
          >
            <option value="">Alle</option>
            <option value="breached">Overskredet</option>
            <option value="due_soon">Forfald &lt; 1 t</option>
            <option value="ok">Inden for SLA</option>
          </select>
        </FilterField>
      </div>

      <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
        Sag og indhold
      </p>
      <div className="flex flex-wrap gap-3">
        <FilterField label="Sagstype">
          <select
            className={selectClass}
            value={filters.ticket_type}
            onChange={(e) => onChange({ ticket_type: e.target.value })}
          >
            <option value="">Alle</option>
            {TICKET_TYPE_VALUES.map((type) => (
              <option key={type} value={type}>
                {ticketTypeLabel(type)}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Store sag">
          <select
            className={selectClass}
            value={filters.is_major}
            onChange={(e) =>
              onChange({ is_major: e.target.value as TicketFieldFilters["is_major"] })
            }
          >
            {YES_NO_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Sikkerhedssag">
          <select
            className={selectClass}
            value={filters.is_security}
            onChange={(e) =>
              onChange({
                is_security: e.target.value as TicketFieldFilters["is_security"],
              })
            }
          >
            {YES_NO_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Tag">
          <select
            className={selectClass}
            value={filters.tag}
            onChange={(e) => onChange({ tag: e.target.value })}
          >
            <option value="">Alle tags</option>
            {options.tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Oprettet">
          <select
            className={selectClass}
            value={filters.created_within}
            onChange={(e) =>
              onChange({
                created_within: e.target.value as TicketFieldFilters["created_within"],
              })
            }
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Opdateret">
          <select
            className={selectClass}
            value={filters.updated_within}
            onChange={(e) =>
              onChange({
                updated_within: e.target.value as TicketFieldFilters["updated_within"],
              })
            }
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Beskeder">
          <select
            className={selectClass}
            value={filters.has_comments}
            onChange={(e) =>
              onChange({
                has_comments: e.target.value as TicketFieldFilters["has_comments"],
              })
            }
          >
            {YES_NO_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Interne noter">
          <select
            className={selectClass}
            value={filters.has_internal_comments}
            onChange={(e) =>
              onChange({
                has_internal_comments:
                  e.target.value as TicketFieldFilters["has_internal_comments"],
              })
            }
          >
            {YES_NO_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Vedhæftninger">
          <select
            className={selectClass}
            value={filters.has_attachments}
            onChange={(e) =>
              onChange({
                has_attachments: e.target.value as TicketFieldFilters["has_attachments"],
              })
            }
          >
            {YES_NO_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </FilterField>
      </div>
    </div>
  );
}

export { DEFAULT_TICKET_FIELD_FILTERS };
