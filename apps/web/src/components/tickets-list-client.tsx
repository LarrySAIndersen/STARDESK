"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { WireframeTicketTable } from "@/components/wireframe/wireframe-ticket-table";
import { TicketSearchInput } from "@/components/ticket-search-input";
import { priorityLabel, statusLabel } from "@/lib/ticket-labels";
import { ticketMatchesSearch } from "@/lib/ticket-tags";
import { dashboardFilterTitle } from "@/lib/tickets-api-query";
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

export function TicketsListClient({
  tickets,
  initialParams = {},
}: {
  tickets: Ticket[];
  initialParams?: Record<string, string | string[] | undefined>;
}) {
  const dashboardFilter = dashboardFilterTitle(initialParams);
  const fromDashboard = Boolean(dashboardFilter);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(
    () => pickParam(initialParams.status) ?? "",
  );
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [tagFilter, setTagFilter] = useState("");

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

  const filtered = useMemo(() => {
    const sla = pickParam(initialParams.sla);
    const openOnly = pickParam(initialParams.open_only) === "true";
    const majorOpen = pickParam(initialParams.major_open) === "true";

    return tickets.filter((t) => {
      if (openOnly && ["resolved", "closed", "cancelled"].includes(t.status)) {
        return false;
      }
      if (majorOpen && !t.is_major) return false;
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
  }, [tickets, status, priority, category, tagFilter, search, initialParams]);

  const activeTags = [tagFilter].filter(Boolean);

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
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="wire-form-input h-8 w-auto min-w-[120px] text-xs"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
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
          onChange={(e) => setPriority(e.target.value)}
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
          onChange={(e) => setCategory(e.target.value)}
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
          onChange={(e) => setTagFilter(e.target.value)}
          aria-label="Filtrer tag"
        >
          <option value="">Alle tags</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
        <TicketSearchInput value={search} onChange={setSearch} />
      </div>

      {activeTags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {activeTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="wire-tag"
              onClick={() => setTagFilter("")}
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
