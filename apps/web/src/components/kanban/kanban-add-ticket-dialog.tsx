"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import { useCallback, useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { apiGet, apiPost } from "@/lib/api";
import { priorityLabel, statusLabel } from "@/lib/ticket-labels";
import type { KanbanTicketSearchResult } from "@/types/kanban";

export function KanbanAddTicketDialog({
  open,
  boardId,
  columnId,
  onClose,
  onAdded,
}: {
  open: boolean;
  boardId: string;
  columnId: string | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  const titleId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KanbanTicketSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trapRef = useFocusTrap(open);

  const search = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const hits = await apiGet<KanbanTicketSearchResult[]>(
          `/api/v1/kanban/boards/${boardId}/ticket-search?q=${encodeURIComponent(q.trim())}`,
        );
        setResults(hits);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    [boardId],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const timer = window.setTimeout(() => {
      fireAndForget(search(query));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [open, query, search]);

  if (!open || !columnId) {
    return null;
  }

  async function handleAdd(ticketId: string) {
    setAddingId(ticketId);
    setError(null);
    try {
      await apiPost(`/api/v1/kanban/boards/${boardId}/cards`, {
        column_id: columnId,
        ticket_id: ticketId,
      });
      onAdded();
      onClose();
      setQuery("");
      setResults([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke tilføje sag.");
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 border-0 bg-black/50 p-0"
        aria-label="Luk dialog"
        onClick={onClose}
      />
      <div
        ref={trapRef}
        role="dialog"
        aria-labelledby={titleId}
        aria-modal="true"
        className="ledger-card relative w-full max-w-lg space-y-4 p-5"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <h2 id={titleId} className="text-lg font-semibold">
          Tilføj eksisterende sag
        </h2>
        <div className="space-y-2">
          <Label htmlFor="kanban-add-search">Søg efter nummer eller titel</Label>
          <Input
            id="kanban-add-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Fx INC-1234 eller nøgleord…"
            autoFocus
          />
        </div>
        <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-[var(--gray-border)] p-2">
          {query.trim().length < 2 ? (
            <li className="text-muted-foreground py-4 text-center text-sm">
              Skriv mindst 2 tegn for at søge
            </li>
          ) : searching ? (
            <li className="text-muted-foreground py-4 text-center text-sm">Søger…</li>
          ) : results.length === 0 ? (
            <li className="text-muted-foreground py-4 text-center text-sm">Ingen sager fundet</li>
          ) : (
            results.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  className="hover:bg-muted flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm"
                  disabled={addingId === hit.id}
                  onClick={() => fireAndForget(handleAdd(hit.id))}
                >
                  <span className="text-muted-foreground shrink-0 font-mono text-xs">
                    {hit.ticket_number}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 font-medium">{hit.title}</span>
                    <span className="text-muted-foreground text-xs">
                      {statusLabel(hit.status)} · {priorityLabel(hit.priority)}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Luk
          </Button>
        </div>
      </div>
    </div>
  );
}
