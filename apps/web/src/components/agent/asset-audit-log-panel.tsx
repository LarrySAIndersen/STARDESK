"use client";

import { useCallback, useEffect, useState } from "react";
import { History, Loader2, Search } from "lucide-react";

import { fetchCmdbAuditLog } from "@/lib/cmdb-api";
import { useAssetCatalog } from "@/components/agent/asset-catalog-context";
import type { CmdbAuditEntry } from "@/types/cmdb-audit";

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

const ACTION_LABELS: Record<string, string> = {
  create: "Oprettet",
  update: "Opdateret",
  delete: "Slettet",
  connection_add: "Forbindelse",
  connection_remove: "Fjernet forbind.",
};

export function AssetAuditLogPanel() {
  const { auditLogVersion } = useAssetCatalog();
  const [items, setItems] = useState<CmdbAuditEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextBeforeId, setNextBeforeId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInitial = useCallback(async (search?: string) => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchCmdbAuditLog({ q: search, byteBudget: 1_048_576 });
      setItems(page.items);
      setHasMore(page.has_more);
      setNextBeforeId(page.next_before_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke hente log");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInitial(query);
  }, [loadInitial, auditLogVersion]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    void loadInitial(query);
  };

  const loadMore = async () => {
    if (!nextBeforeId || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchCmdbAuditLog({
        beforeId: nextBeforeId,
        q: query || undefined,
        byteBudget: 1_048_576,
      });
      setItems((prev) => [...prev, ...page.items]);
      setHasMore(page.has_more);
      setNextBeforeId(page.next_before_id);
    } catch {
      setError("Kunne ikke hente flere poster");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <aside
      className="wire-assets-card flex h-full min-h-0 w-full flex-col"
      aria-label="CMDB ændringslog"
    >
      <div className="border-b border-[var(--gray-border)] px-3 py-2.5">
        <h2 className="text-star-navy flex items-center gap-1.5 text-[11px] font-bold tracking-wide uppercase">
          <History className="size-3.5" aria-hidden />
          Ændringslog
        </h2>
        <p className="text-muted-foreground mt-0.5 text-[10px]">Kun administrator · hvem, hvad, hvornår</p>
        <form onSubmit={handleSearch} className="mt-2">
          <div className="relative">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Søg i log…"
              className="border-input bg-background h-8 w-full rounded-sm border pr-2 pl-7 text-[11px] outline-none focus-visible:border-star-navy"
            />
          </div>
        </form>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <p className="text-muted-foreground flex items-center gap-1.5 py-4 text-[11px]">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Indlæser…
          </p>
        ) : error ? (
          <p className="text-star-red py-2 text-[11px]" role="alert">
            {error}
          </p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground py-4 text-[11px]">Ingen logposter endnu.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((entry) => (
              <li
                key={entry.id}
                className="border-[var(--gray-border)] rounded-sm border bg-[var(--gray-soft)]/50 px-2 py-1.5"
              >
                <p className="text-star-navy text-[11px] leading-snug font-medium">
                  {entry.summary_da}
                </p>
                <p className="text-muted-foreground mt-0.5 text-[10px]">
                  {entry.actor_display_name} · {formatWhen(entry.created_at)}
                </p>
                <p className="text-muted-foreground mt-0.5 text-[9px]">
                  {ACTION_LABELS[entry.action] ?? entry.action} · {entry.entity_label || entry.entity_id}
                </p>
              </li>
            ))}
          </ul>
        )}

        {hasMore && !loading ? (
          <button
            type="button"
            className="text-star-blue hover:text-star-navy mt-2 w-full py-1 text-center text-[10px] font-semibold"
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? "Henter…" : "Hent flere"}
          </button>
        ) : null}
      </div>
    </aside>
  );
}
