"use client";

import { useCallback, useMemo, useState } from "react";
import { Pin, PinOff, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiDelete, apiPatch, apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { PersonalNote, PersonalNoteCreate, PersonalNoteUpdate } from "@/types/personal";

const NOTE_COLORS = [
  { id: "yellow", className: "bg-amber-50 border-amber-200" },
  { id: "blue", className: "bg-sky-50 border-sky-200" },
  { id: "green", className: "bg-emerald-50 border-emerald-200" },
  { id: "pink", className: "bg-rose-50 border-rose-200" },
] as const;

function noteColorClass(color: string | null): string {
  return NOTE_COLORS.find((c) => c.id === color)?.className ?? "bg-card border-border";
}

export function PersonalNotesPanel({ initialNotes }: { initialNotes: PersonalNote[] }) {
  const [notes, setNotes] = useState(initialNotes);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedNotes = useMemo(
    () =>
      [...notes].sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return a.sort_order - b.sort_order || b.updated_at.localeCompare(a.updated_at);
      }),
    [notes],
  );

  const createNote = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const payload: PersonalNoteCreate = {
        title: trimmed,
        content: content.trim(),
      };
      const created = await apiPost<PersonalNote>("/api/v1/personal/notes", payload);
      setNotes((prev) => [...prev, created]);
      setTitle("");
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke oprette note");
    } finally {
      setBusy(false);
    }
  }, [content, title]);

  const patchNote = useCallback(async (noteId: string, payload: PersonalNoteUpdate) => {
    const updated = await apiPatch<PersonalNote>(`/api/v1/personal/notes/${noteId}`, payload);
    setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)));
  }, []);

  const deleteNote = useCallback(async (noteId: string) => {
    await apiDelete(`/api/v1/personal/notes/${noteId}`);
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, []);

  return (
    <section className="wire-card mb-0 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="wire-sec-title text-base">Huskeliste</h2>
          <p className="text-muted-foreground text-sm">Private noter kun synlige for dig.</p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void createNote();
        }}
        autoComplete="off"
        className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titel — fx ring til leverandør"
          aria-label="Note-titel"
          autoComplete="off"
          name="note-title-input"
        />
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Detaljer (valgfrit)"
          rows={1}
          className="min-h-9 resize-none"
          aria-label="Note-indhold"
          autoComplete="off"
          name="note-content-input"
        />
        <Button type="submit" disabled={busy || !title.trim()}>
          <Plus className="size-4" aria-hidden />
          Tilføj
        </Button>
      </form>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      {sortedNotes.length === 0 ? (
        <p className="text-muted-foreground text-sm">Ingen noter endnu — tilføj noget du skal huske.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sortedNotes.map((note) => (
            <li
              key={note.id}
              className={cn(
                "flex flex-col gap-2 rounded-lg border p-3 shadow-sm",
                noteColorClass(note.color),
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold leading-snug">{note.title}</p>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={note.is_pinned ? "Frigør note" : "Fastgør note"}
                    onClick={() =>
                      void patchNote(note.id, { is_pinned: !note.is_pinned }).catch(() => {})
                    }
                  >
                    {note.is_pinned ? (
                      <PinOff className="size-4" aria-hidden />
                    ) : (
                      <Pin className="size-4" aria-hidden />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive size-8"
                    aria-label="Slet note"
                    onClick={() => void deleteNote(note.id).catch(() => {})}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>
              {note.content ? (
                <p className="text-muted-foreground whitespace-pre-wrap text-sm">{note.content}</p>
              ) : null}
              <div className="mt-auto flex flex-wrap gap-1">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={cn(
                      "size-5 rounded-full border-2",
                      c.className,
                      note.color === c.id && "ring-star-blue ring-2 ring-offset-1",
                    )}
                    aria-label={`Farve ${c.id}`}
                    onClick={() => void patchNote(note.id, { color: c.id }).catch(() => {})}
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
