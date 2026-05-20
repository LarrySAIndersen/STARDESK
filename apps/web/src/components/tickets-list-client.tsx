"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { ClearFiltersButton } from "@/components/clear-filters-button";
import { WireframeTicketTable } from "@/components/wireframe/wireframe-ticket-table";
import { TicketSearchInput } from "@/components/ticket-search-input";
import { useListFilters } from "@/hooks/use-list-filters";
import { priorityLabel, statusLabel } from "@/lib/ticket-labels";
import {
  DEFAULT_TICKET_SORT,
  parseTicketSort,
  TICKET_SORT_OPTIONS,
} from "@/lib/ticket-sort";
import { ticketMatchesAsset } from "@/lib/asset-tickets";
import { MOCK_ASSET_SYSTEMS } from "@/lib/mock-assets";
import { ticketMatchesSearch } from "@/lib/ticket-tags";
import {
  CLEARED_TICKETS_PATH,
  dashboardFilterTitle,
  hasTicketsUrlFilters,
} from "@/lib/tickets-api-query";
import { isOpenTicketStatus } from "@/lib/ticket-open-status";
import type { Ticket } from "@/types/ticket";

function pickParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

const STATUS_OPTIONS = [
  "",
  "open",
  "in_progress",
  "pending",
  "resolved",
  "closed",
] as const;

const PRIORITY_OPTIONS = ["", "critical", "high", "medium", "low"] as const;

const DEFAULT_TICKET_FILTERS: Record<"status" | "priority" | "category" | "tag", string> = {
  status: "",
  priority: "",
  category: "",
  tag: "",
};

export function TicketsListClient({
  tickets,
  initialParams = {},
}: {
  tickets: Ticket[];
  initialParams?: Record<string, string | string[] | undefined>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dashboardFilter = dashboardFilterTitle(initialParams);
  const fromDashboard = Boolean(dashboardFilter);
  const urlFiltersActive = hasTicketsUrlFilters(initialParams);

  const sort = parseTicketSort(
    pickParam(initialParams.sort) ?? searchParams.get("sort"),
  );
  const sortDiffersFromDefault = sort !== DEFAULT_TICKET_SORT;

  const onSortChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === DEFAULT_TICKET_SORT) {
        params.delete("sort");
      } else {
        params.set("sort", value);
      }
      const qs = params.toString();
      router.push(qs ? `/tickets?${qs}` : CLEARED_TICKETS_PATH);
    },
    [router, searchParams],
  );

  const {
    search,
    setSearch,
    filters,
    setFilter,
    reset: resetLocalFilters,
    hasActiveFilters: hasLocalFilters,
  } = useListFilters({
    defaultFilters: {
      ...DEFAULT_TICKET_FILTERS,
      status: pickParam(initialParams.status) ?? "",
    },
  });

  const { status, priority, category, tag: tagFilter } = filters;

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const t of tickets) {
      if (t.category_name_da) set.add(t.category_name_da);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "da"));
  }, [tickets]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const t of tickets) {
      for (const tag of t.tags ?? []) set.add(tag);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "da"));
  }, [tickets]);

  const assetIdFilter =
    pickParam(initialParams.asset_id) ?? searchParams.get("asset_id") ?? undefined;

  const filtered = useMemo(() => {
    const sla = pickParam(initialParams.sla);
    const openOnly = pickParam(initialParams.open_only) === "true";
    const majorOpen = pickParam(initialParams.major_open) === "true";

    return tickets.filter((t) => {
      if (assetIdFilter && !ticketMatchesAsset(t, assetIdFilter, MOCK_ASSET_SYSTEMS)) {
        return false;
      }
      if (openOnly && ["resolved", "closed", "cancelled"].includes(t.status)) {
        return false;
      }
      if (majorOpen && (!t.is_major || !isOpenTicketStatus(t.status))) return false;
      if (sla === "overdue" && !t.sla_breached) return false;
      if (sla === "due_soon") {
        const remaining = t.sla_remaining_seconds;
        if (remaining == null || remaining < 0 || remaining > 3600) return false;
      }
      if (status && t.status !== status) return false;
      if (priority && t.priority !== priority) return false;
      if (category && t.category_name_da !== category) return false;
      if (tagFilter && !(t.tags ?? []).includes(tagFilter)) return false;
      if (!ticketMatchesSearch(t, search)) return false;
      return true;
    });
  }, [tickets, status, priority, category, tagFilter, search, initialParams, assetIdFilter]);

  const activeTags = [tagFilter].filter(Boolean);

  const hasActiveFilters =
    hasLocalFilters || sortDiffersFromDefault || urlFiltersActive;

  const clearAllFilters = useCallback(() => {
    resetLocalFilters();
    if (urlFiltersActive || sortDiffersFromDefault) {
      router.push(CLEARED_TICKETS_PATH);
    }
  }, [
    resetLocalFilters,
    router,
    urlFiltersActive,
    sortDiffersFromDefault,
  ]);

  return (
    <div className="space-y-3">
      {fromDashboard ? (
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/" className="wire-btn wire-btn-sm">
            ← Tilbage til dashboard
          </Link>
          <span className="text-muted-foreground text-xs">
            {filtered.length} sag{filtered.length === 1 ? "" : "er"}
          </span>
          <ClearFiltersButton onClick={clearAllFilters} visible={hasActiveFilters} />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 max-sm:[&_select]:min-w-[calc(50%-0.25rem)] max-sm:[&_select]:flex-1">
        <select
          className="wire-form-input h-8 w-auto min-w-[7.5rem] text-xs"
          value={status}
          onChange={(e) => setFilter("status", e.target.value)}
          aria-label="Filtrer status"
        >
          <option value="">Alle status</option>
          {STATUS_OPTIONS.filter(Boolean).map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
        <select
          className="wire-form-input h-8 w-auto min-w-[120px] text-xs"
          value={priority}
          onChange={(e) => setFilter("priority", e.target.value)}
          aria-label="Filtrer prioritet"
        >
          <option value="">Alle prioriteter</option>
          {PRIORITY_OPTIONS.filter(Boolean).map((p) => (
            <option key={p} value={p}>
              {priorityLabel(p)}
            </option>
          ))}
        </select>
        <select
          className="wire-form-input h-8 w-auto min-w-[120px] text-xs"
          value={category}
          onChange={(e) => setFilter("category", e.target.value)}
          aria-label="Filtrer kategori"
        >
          <option value="">Alle kategorier</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className="wire-form-input h-8 w-auto min-w-[100px] text-xs"
          value={tagFilter}
          onChange={(e) => setFilter("tag", e.target.value)}
          aria-label="Filtrer tag"
        >
          <option value="">Alle tags</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
        <select
          className="wire-form-input h-8 w-auto min-w-[140px] text-xs"
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          aria-label="Sorter sager"
        >
          {TICKET_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <TicketSearchInput value={search} onChange={setSearch} />
        <ClearFiltersButton
          onClick={clearAllFilters}
          visible={hasActiveFilters && !fromDashboard}
        />
      </div>

      {activeTags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {activeTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="wire-tag"
              onClick={() => setFilter("tag", "")}
            >
              {tag} ×
            </button>
          ))}
        </div>
      ) : null}

      <WireframeTicketTable tickets={filtered} />
    </div>
  );
}
