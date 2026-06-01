"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { apiGet, apiPatch } from "@/lib/api";
import type { ReviewNote, ReviewNoteStatus } from "@/types/review-note";

function formatTimestamp(value: string): string {
  try {
    return new Intl.DateTimeFormat("da-DK", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function placementLabel(note: ReviewNote): string {
  return `x: ${Math.round(note.position_x)}, y: ${Math.round(note.position_y)}`;
}

export function ForbedringerPanel() {
  const [notes, setNotes] = useState<ReviewNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReviewNoteStatus | "all">("open");
  const [pageFilter, setPageFilter] = useState("");

  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      const qs = params.toString();
      const data = await apiGet<ReviewNote[]>(
        `/api/v1/review-notes${qs ? `?${qs}` : ""}`,
      );
      setNotes(data);
      setError(null);
    } catch {
      setError("Kunne ikke hente forbedringer.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fireAndForget(loadNotes());
  }, [loadNotes]);

  const filteredNotes = useMemo(() => {
    const q = pageFilter.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (note) =>
        note.page_path.toLowerCase().includes(q) ||
        note.page_title.toLowerCase().includes(q),
    );
  }, [notes, pageFilter]);

  const resolveNote = async (noteId: string) => {
    await apiPatch(`/api/v1/review-notes/${noteId}`, { status: "resolved" });
    await loadNotes();
  };

  return (
    <div className="wire-card space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="wire-card-title text-xl">Forbedringer</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gule sedler fra Stardesk Reviewer med side, person, kommentar og placering.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => fireAndForget(loadNotes())}>
          Opdater
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">Filtrér efter side</span>
          <input
            type="search"
            value={pageFilter}
            onChange={(event) => setPageFilter(event.target.value)}
            placeholder="fx /tickets eller Service Desk"
            className="border-input bg-background rounded-md border px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:w-48">
          <span className="font-medium">Status</span>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as ReviewNoteStatus | "all")
            }
            className="border-input bg-background rounded-md border px-3 py-2 text-sm"
          >
            <option value="all">Alle</option>
            <option value="open">Åbne</option>
            <option value="resolved">Løste</option>
          </select>
        </label>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm" aria-live="polite">
          Henter forbedringer…
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-[#c41e2a]" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && filteredNotes.length === 0 ? (
        <p className="text-muted-foreground text-sm">Ingen forbedringer matcher filteret.</p>
      ) : null}

      <ul className="divide-y divide-[var(--gray-border)]">
        {filteredNotes.map((note) => (
          <li key={note.id} className="space-y-2 py-4 first:pt-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={
                  note.status === "open"
                    ? "rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900"
                    : "bg-muted text-muted-foreground rounded px-2 py-0.5 text-xs font-semibold"
                }
              >
                {note.status === "open" ? "Åben" : "Løst"}
              </span>
              <Link href={note.page_path} className="text-star-blue text-sm font-medium hover:underline">
                {note.page_title || note.page_path}
              </Link>
              <span className="text-muted-foreground text-xs">{note.page_path}</span>
            </div>
            <p className="text-sm leading-relaxed">{note.comment}</p>
            <dl className="text-muted-foreground grid gap-1 text-xs sm:grid-cols-3">
              <div>
                <dt className="font-medium text-foreground">Person</dt>
                <dd>
                  {note.created_by_name}
                  {note.created_by_email ? ` (${note.created_by_email})` : ""}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Placering</dt>
                <dd>{placementLabel(note)}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Oprettet</dt>
                <dd>{formatTimestamp(note.created_at)}</dd>
              </div>
            </dl>
            {note.status === "open" ? (
              <Button type="button" size="sm" variant="outline" onClick={() => fireAndForget(resolveNote(note.id))}>
                Markér som løst
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
