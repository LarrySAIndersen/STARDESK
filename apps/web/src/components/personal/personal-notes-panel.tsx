"use client";

import { useCallback, useMemo, useState, type DragEvent } from "react";
import { Plus, Trash2 } from "lucide-react";

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
import { PERSONAL_NOTE_DRAG_MIME, readDraggedNoteId } from "@/lib/personal-board-dnd";
import { cn } from "@/lib/utils";
import type { PersonalNote, PersonalNoteCreate, PersonalNoteUpdate } from "@/types/personal";

function DraggablePostIt({
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
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(PERSONAL_NOTE_DRAG_MIME, note.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "personal-notes-tray__card post-it-note group cursor-grab active:cursor-grabbing",
        personalNoteColorClass(note.color),
        index % 2 === 0 ? "-rotate-[2deg]" : "rotate-[1.5deg]",
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="line-clamp-2 text-sm leading-snug font-semibold">{note.title}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="personal-notes-tray__delete size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          aria-label="Slet seddel"
          onClick={() => void onDelete(note.id).catch(() => {})}
        >
          <Trash2 className="text-destructive size-3.5" aria-hidden />
        </Button>
      </div>
      {note.content ? (
        <p className="text-star-text-muted mt-1 line-clamp-2 text-xs">{note.content}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1">
        {PERSONAL_NOTE_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={cn(
              "size-4 rounded-full border border-white/80 shadow-sm",
              c.swatchClassName,
              resolveNoteColorId(note.color) === c.id && "ring-star-navy ring-1 ring-offset-1",
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

export function PersonalNotesPanel({
  notes,
  onNotesChange,
  onNoteDropToTray,
}: {
  notes: PersonalNote[];
  onNotesChange: (notes: PersonalNote[]) => void;
  onNoteDropToTray?: (noteId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trayDragOver, setTrayDragOver] = useState(false);

  const trayNotes = useMemo(
    () =>
      [...notes]
        .filter((n) => !n.is_pinned)
        .sort((a, b) => a.sort_order - b.sort_order || b.updated_at.localeCompare(a.updated_at)),
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
        color: "navy",
      };
      const created = await apiPost<PersonalNote>("/api/v1/personal/notes", payload);
      onNotesChange([...notes, created]);
      setTitle("");
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke oprette note");
    } finally {
      setBusy(false);
    }
  }, [content, notes, onNotesChange, title]);

  const patchNote = useCallback(
    async (noteId: string, payload: PersonalNoteUpdate) => {
      const updated = await apiPatch<PersonalNote>(`/api/v1/personal/notes/${noteId}`, payload);
      onNotesChange(notes.map((n) => (n.id === noteId ? updated : n)));
    },
    [notes, onNotesChange],
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      await apiDelete(`/api/v1/personal/notes/${noteId}`);
      onNotesChange(notes.filter((n) => n.id !== noteId));
    },
    [notes, onNotesChange],
  );

  const handleTrayDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setTrayDragOver(true);
  };

  const handleTrayDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setTrayDragOver(false);
    const noteId = readDraggedNoteId(e.dataTransfer);
    if (noteId && onNoteDropToTray) {
      onNoteDropToTray(noteId);
    }
  };

  return (
    <section className="wire-card mb-0 flex flex-col gap-4">
      <div>
        <h2 className="wire-sec-title text-base">Huskeliste</h2>
        <p className="text-muted-foreground text-sm">
          Opret sedler her — <strong>træk dem op</strong> på opslagstavlen til venstre.
        </p>
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

      <div
        className={cn(
          "personal-notes-tray",
          trayDragOver && "personal-notes-tray--drop-active",
        )}
        onDragOver={handleTrayDragOver}
        onDragLeave={() => setTrayDragOver(false)}
        onDrop={handleTrayDrop}
        aria-label="Sedler klar til at trække på opslagstavlen"
      >
        {trayNotes.length === 0 ? (
          <p className="text-muted-foreground px-2 py-6 text-center text-sm">
            {notes.some((n) => n.is_pinned)
              ? "Alle sedler hænger på tavlen — træk en ned hertil for at frigøre den."
              : "Ingen sedler i bakken — opret en og træk den op på tavlen."}
          </p>
        ) : (
          <ul className="personal-notes-tray__list">
            {trayNotes.map((note, index) => (
              <DraggablePostIt
                key={note.id}
                note={note}
                index={index}
                onPatch={patchNote}
                onDelete={deleteNote}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
