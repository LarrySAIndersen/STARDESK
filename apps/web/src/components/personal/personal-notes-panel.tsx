"use client";

import { useCallback, useMemo, useState } from "react";
import { Pin, PinOff, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiDelete, apiPatch, apiPost } from "@/lib/api";
import {
  PERSONAL_NOTE_COLORS,
  personalNoteColorClass,
  resolveNoteColorId,
  type PersonalNoteColorId,
} from "@/lib/personal-note-colors";
import { cn } from "@/lib/utils";
import type { PersonalNote, PersonalNoteCreate, PersonalNoteUpdate } from "@/types/personal";

function NoteCard({
  note,
  index,
  onPatch,
  onDelete,
}: {
  note: PersonalNote;
  index: number;
  onPatch: (noteId: string, payload: PersonalNoteUpdate) => Promise<void>;
  onDelete: (noteId: string) => Promise<void>;
}) {
  return (
    <li
      className={cn(
        "post-it-note flex flex-col gap-2 rounded-sm border p-3 shadow-md",
        personalNoteColorClass(note.color),
        index % 2 === 0 ? "-rotate-[0.4deg]" : "rotate-[0.35deg]",
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
            onClick={() => void onPatch(note.id, { is_pinned: !note.is_pinned }).catch(() => {})}
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
            onClick={() => void onDelete(note.id).catch(() => {})}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
      {note.content ? (
        <p className="text-star-text-muted whitespace-pre-wrap text-sm">{note.content}</p>
      ) : null}
      <div className="mt-auto flex flex-wrap gap-1.5">
        {PERSONAL_NOTE_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={cn(
              "size-5 rounded-full border-2 border-white/80 shadow-sm",
              c.swatchClassName,
              resolveNoteColorId(note.color) === c.id && "ring-star-navy ring-2 ring-offset-1",
            )}
            aria-label={`Farve ${c.label}`}
            onClick={() =>
              void onPatch(note.id, { color: c.id as PersonalNoteColorId }).catch(() => {})
            }
          />
        ))}
      </div>
    </li>
  );
}

export function PersonalNotesPanel({ initialNotes }: { initialNotes: PersonalNote[] }) {
  const [notes, setNotes] = useState(initialNotes);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { pinnedNotes, otherNotes } = useMemo(() => {
    const sorted = [...notes].sort(
      (a, b) => a.sort_order - b.sort_order || b.updated_at.localeCompare(a.updated_at),
    );
    return {
      pinnedNotes: sorted.filter((n) => n.is_pinned),
      otherNotes: sorted.filter((n) => !n.is_pinned),
    };
  }, [notes]);

  const createNote = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const payload: PersonalNoteCreate = {
        title: trimmed,
        content: content.trim(),
        color: "navy",
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
          <p className="text-muted-foreground text-sm">
            Private noter kun synlige for dig. Fastgør med nålen — de vises til venstre og i menuen.
          </p>
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

      {notes.length === 0 ? (
        <p className="text-muted-foreground text-sm">Ingen noter endnu — tilføj noget du skal huske.</p>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          {pinnedNotes.length > 0 ? (
            <aside className="w-full shrink-0 lg:w-52 xl:w-56">
              <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold">
                <Pin className="size-3.5 shrink-0" aria-hidden />
                Fastgjort til venstre
              </p>
              <ul className="flex flex-col gap-3">
                {pinnedNotes.map((note, index) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    index={index}
                    onPatch={patchNote}
                    onDelete={deleteNote}
                  />
                ))}
              </ul>
            </aside>
          ) : null}

          {otherNotes.length > 0 ? (
            <ul
              className={cn(
                "grid flex-1 gap-3 sm:grid-cols-2",
                pinnedNotes.length > 0 ? "xl:grid-cols-2" : "xl:grid-cols-3",
              )}
            >
              {otherNotes.map((note, index) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  index={index}
                  onPatch={patchNote}
                  onDelete={deleteNote}
                />
              ))}
            </ul>
          ) : pinnedNotes.length > 0 ? (
            <p className="text-muted-foreground flex-1 text-sm">
              Alle dine noter er fastgjort — frigør en note for at flytte den til hovedlisten.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
