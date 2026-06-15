"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, ImageIcon } from "lucide-react";

import { ForbedringerNoteDetailDialog } from "@/components/forbedringer/forbedringer-note-detail-dialog";
import { Button } from "@/components/ui/button";
import { apiGet, apiPatch, deleteReviewNote, reviewNoteScreenshotUrl } from "@/lib/api";
import { firstName } from "@/lib/display-name";
import { isAdmin } from "@/lib/auth";
import { reviewNoteRoleColor } from "@/lib/review-note-role-colors";
import { cn } from "@/lib/utils";
import type { ReviewNote, ReviewNoteStatus } from "@/types/review-note";
import type { User } from "@/types/user";

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

const STATUS_COLUMNS: ReadonlyArray<{
  status: ReviewNoteStatus;
  title: string;
  empty: string;
}> = [
  { status: "open", title: "Åben", empty: "Ingen åbne sedler." },
  { status: "resolved", title: "Løst", empty: "Ingen løste sedler." },
  { status: "deleted", title: "Slettet", empty: "Ingen slettede sedler." },
];

function statusLabel(status: ReviewNoteStatus): string {
  if (status === "open") return "Åben";
  if (status === "resolved") return "Løst";
  return "Slettet";
}

function statusBadgeClass(status: ReviewNoteStatus): string {
  if (status === "open") {
    return "rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900";
  }
  if (status === "resolved") {
    return "bg-muted text-muted-foreground rounded px-2 py-0.5 text-xs font-semibold";
  }
  return "rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700";
}

function withReviewNumbers(notes: ReviewNote[]): ReviewNote[] {
  const byId = new Map(
    [...notes]
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
      .map((note, index) => [note.id, `REV-${String(index + 1).padStart(5, "0")}`]),
  );
  return notes.map((note) => ({
    ...note,
    review_number: note.review_number || byId.get(note.id) || "",
  }));
}

function reviewNumberLabel(note: ReviewNote): string {
  return note.review_number || "REV-?????";
}

export function ForbedringerPanel({ user }: { user: User | null }) {
  const [notes, setNotes] = useState<ReviewNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageFilter, setPageFilter] = useState("");
  const [selectedNote, setSelectedNote] = useState<ReviewNote | null>(null);
  const canDeleteNotes = isAdmin(user);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<ReviewNote[]>("/api/v1/review-notes");
      setNotes(withReviewNumbers(data));
      setError(null);
    } catch {
      setError("Kunne ikke hente forbedringer.");
    } finally {
      setLoading(false);
    }
  }, []);

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
    setSelectedNote(null);
    await loadNotes();
  };

  const notesByStatus = useMemo(
    () =>
      STATUS_COLUMNS.reduce(
        (acc, column) => {
          acc[column.status] = filteredNotes.filter((note) => note.status === column.status);
          return acc;
        },
        {} as Record<ReviewNoteStatus, ReviewNote[]>,
      ),
    [filteredNotes],
  );

  const deleteNote = async (noteId: string) => {
    const deleted = await deleteReviewNote(noteId);
    setSelectedNote(null);
    setNotes((prev) => {
      const existing = prev.find((note) => note.id === noteId);
      const nextDeleted =
        deleted ??
        (existing
          ? { ...existing, status: "deleted" as const, updated_at: new Date().toISOString() }
          : null);
      if (!nextDeleted) return prev;
      const next = prev.some((note) => note.id === nextDeleted.id)
        ? prev.map((note) => (note.id === nextDeleted.id ? nextDeleted : note))
        : [nextDeleted, ...prev];
      return withReviewNumbers(next);
    });
  };

  return (
    <>
      <div className="wire-card space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="wire-card-title text-xl">Forbedringer</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Sedler fra review med farve efter rolle, forfatter (fornavn) og sideplacering.
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

        <div className="grid gap-4 lg:grid-cols-3">
          {STATUS_COLUMNS.map((column) => {
            const columnNotes = notesByStatus[column.status];
            return (
              <section
                key={column.status}
                className="rounded-lg border border-[var(--gray-border)] bg-background/60"
                aria-labelledby={`review-notes-${column.status}`}
              >
                <div className="flex items-center justify-between gap-2 border-b border-[var(--gray-border)] px-3 py-2">
                  <h2 id={`review-notes-${column.status}`} className="text-sm font-semibold">
                    {column.title}
                  </h2>
                  <span className="text-muted-foreground text-xs">{columnNotes.length}</span>
                </div>
                {columnNotes.length === 0 ? (
                  <p className="text-muted-foreground px-3 py-4 text-sm">{column.empty}</p>
                ) : (
                  <ul className="divide-y divide-[var(--gray-border)]">
                    {columnNotes.map((note) => {
                      const roleColor = reviewNoteRoleColor(note.created_by_role);
                      return (
                      <li key={note.id} className="p-3">
                        <button
                          type="button"
                          className={cn(
                            "hover:bg-muted/40 -mx-2 w-[calc(100%+1rem)] rounded-md border-l-4 px-2 py-2 text-left transition-colors",
                            roleColor.surfaceClassName,
                          )}
                          onClick={() => setSelectedNote(note)}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold">{reviewNumberLabel(note)}</span>
                            <span className={statusBadgeClass(note.status)}>
                              {statusLabel(note.status)}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {note.created_by_role_label ?? roleColor.label}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">
                              {note.page_title || note.page_path}
                            </span>
                          </div>
                          <p className="text-muted-foreground mt-1 truncate text-xs">{note.page_path}</p>
                          <p className="mt-2 line-clamp-3 text-sm leading-relaxed">{note.comment}</p>
                          <dl className="text-muted-foreground mt-2 grid gap-1 text-xs">
                            <div>
                              <dt className="sr-only">Person</dt>
                              <dd>
                                {firstName(note.created_by_name)}
                                {note.created_by_email ? ` · ${note.created_by_email}` : ""}
                              </dd>
                            </div>
                            <div>
                              <dt className="sr-only">Placering</dt>
                              <dd>{placementLabel(note)}</dd>
                            </div>
                            <div>
                              <dt className="sr-only">Oprettet</dt>
                              <dd>{formatTimestamp(note.created_at)}</dd>
                            </div>
                          </dl>
                        </button>

                        {note.has_screenshot ? (
                          <button
                            type="button"
                            className="border-input mt-3 block w-full rounded-md border bg-muted/20 p-1"
                            onClick={() => setSelectedNote(note)}
                            aria-label={`Vis skærmbillede for ${note.page_title || note.page_path}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={reviewNoteScreenshotUrl(note.id)}
                              alt=""
                              className="max-h-24 w-full object-contain object-left"
                              loading="lazy"
                            />
                          </button>
                        ) : null}

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {note.has_screenshot ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedNote(note)}
                            >
                              <ImageIcon className="size-3.5" aria-hidden />
                              Skærmbillede
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="gap-2"
                            onClick={() => setSelectedNote(note)}
                          >
                            Detaljer
                            <ChevronRight className="size-4" aria-hidden />
                          </Button>
                          <Link
                            href={note.page_path}
                            className="text-star-blue px-1 text-xs font-medium hover:underline"
                          >
                            Åbn side
                          </Link>
                          {canDeleteNotes && note.status !== "deleted" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => fireAndForget(deleteNote(note.id))}
                            >
                              Slet
                            </Button>
                          ) : null}
                        </div>
                      </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {selectedNote ? (
        <ForbedringerNoteDetailDialog
          note={selectedNote}
          onClose={() => setSelectedNote(null)}
          onResolve={
            selectedNote.status === "open"
              ? () => fireAndForget(resolveNote(selectedNote.id))
              : undefined
          }
          onDelete={
            canDeleteNotes && selectedNote.status !== "deleted"
              ? () => fireAndForget(deleteNote(selectedNote.id))
              : undefined
          }
        />
      ) : null}
    </>
  );
}
