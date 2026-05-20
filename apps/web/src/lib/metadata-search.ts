import type { Category, Subcategory } from "@/types/category";
import type { SearchableOption } from "@/lib/assignment-search";
import { priorityLabel, ticketTypeLabel } from "@/lib/ticket-labels";
import { ticketSourceLabelDa } from "@/lib/ticket-source-label";

function normalizeQuery(query: string): string {
  return query.trim().toLocaleLowerCase("da");
}

function matchesQuery(text: string, query: string): boolean {
  if (!query) {
    return true;
  }
  return text.toLocaleLowerCase("da").includes(query);
}

export function filterCategoriesForSearch(
  categories: Category[],
  query: string,
): SearchableOption[] {
  const q = normalizeQuery(query);
  return categories
    .filter((category) => matchesQuery(category.name_da, q))
    .map((category) => ({ id: category.id, label: category.name_da }));
}

export function filterSubcategoriesForSearch(
  subcategories: Subcategory[],
  query: string,
): SearchableOption[] {
  const q = normalizeQuery(query);
  return subcategories
    .filter((sub) => matchesQuery(sub.name_da, q))
    .map((sub) => ({ id: sub.id, label: sub.name_da }));
}

export const TICKET_PRIORITY_VALUES = ["critical", "high", "medium", "low"] as const;
export const TICKET_TYPE_VALUES = ["incident", "service_request", "problem"] as const;
export const TICKET_SOURCE_VALUES = [
  "portal",
  "email",
  "phone",
  "chat",
  "api",
  "knowledge",
] as const;

export function filterPrioritiesForSearch(query: string): SearchableOption[] {
  const q = normalizeQuery(query);
  return TICKET_PRIORITY_VALUES.filter((value) =>
    matchesQuery(priorityLabel(value), q),
  ).map((value) => ({ id: value, label: priorityLabel(value) }));
}

export function filterTicketTypesForSearch(query: string): SearchableOption[] {
  const q = normalizeQuery(query);
  return TICKET_TYPE_VALUES.filter((value) =>
    matchesQuery(ticketTypeLabel(value), q),
  ).map((value) => ({ id: value, label: ticketTypeLabel(value) }));
}

export function filterSourcesForSearch(query: string): SearchableOption[] {
  const q = normalizeQuery(query);
  return TICKET_SOURCE_VALUES.filter((value) =>
    matchesQuery(ticketSourceLabelDa(value), q),
  ).map((value) => ({ id: value, label: ticketSourceLabelDa(value) }));
}

export const METADATA_FIELD_CHANGE_REASON = "Ændret i metadata-panelet.";
