/** Sort options for Alle sager (/tickets) — synced with API `sort` query param. */

export const DEFAULT_TICKET_SORT = "created_desc";

export const TICKET_SORT_OPTIONS = [
  { value: "created_desc", label: "Seneste først" },
  { value: "created_asc", label: "Ældste først" },
  { value: "priority_desc", label: "Prioritet (høj → lav)" },
  { value: "sla_asc", label: "SLA (mindst tid tilbage først)" },
  { value: "ticket_number_asc", label: "Sagsnr." },
  { value: "title_asc", label: "Titel A–Å" },
] as const;

export type TicketSortValue = (typeof TICKET_SORT_OPTIONS)[number]["value"];

const VALID_SORTS = new Set<string>(
  TICKET_SORT_OPTIONS.map((o) => o.value),
);

export function parseTicketSort(
  value: string | undefined | null,
): TicketSortValue {
  if (value && VALID_SORTS.has(value)) {
    return value as TicketSortValue;
  }
  return DEFAULT_TICKET_SORT;
}
