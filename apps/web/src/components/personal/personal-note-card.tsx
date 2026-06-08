"use client";

import { useCallback, useEffect, useState } from "react";
import { GripVertical, Pin, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiPatch } from "@/lib/api";
import { personalNoteColorClass } from "@/lib/personal-note-colors";
import { cn } from "@/lib/utils";
import type { PersonalNote, PersonalNoteUpdate } from "@/types/personal";

type PersonalNoteCardProps = Readonly<{
  note: PersonalNote;
  variant: "stack" | "board";
  dragging?: boolean;
  onNoteUpdated: (note: PersonalNote) => void;
  onDelete?: () => void;
  onPinToBoard?: () => void;
  onDragStart?: (noteId: string, clientX: number, clientY: number) => void;
}>;

export function PersonalNoteCard({
  note,
  variant,
  dragging = false,
  onNoteUpdated,
  onDelete,
  onPinToBoard,
  onDragStart,
}: PersonalNoteCardProps) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
  }, [note.id, note.title, note.content]);

  const save = useCallback(
    async (payload: PersonalNoteUpdate) => {
      const updated = await apiPatch<PersonalNote>(`/api/v1/personal/notes/${note.id}`, payload);
      onNoteUpdated(updated);
    },
    [note.id, onNoteUpdated],
  );

  const label = note.note_number || "Idé";

  return (
    <article
      className={cn(
        "min-side-note post-it-note",
        personalNoteColorClass(note.color),
        variant === "stack" && "min-side-note--stack",
        variant === "board" && "min-side-note--board",
        dragging && "min-side-note--dragging",
      )}
    >
      <header
        className="min-side-note__header"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          if ((event.target as HTMLElement).closest("button,input,textarea")) return;
          event.preventDefault();
          (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
          onDragStart?.(note.id, event.clientX, event.clientY);
        }}
      >
        <button
          type="button"
          className="min-side-note__handle"
          aria-label={`Træk ${label}`}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            onDragStart?.(note.id, event.clientX, event.clientY);
          }}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        <div className="min-side-note__meta">
          <span className="min-side-note__number">{label}</span>
          <span className="min-side-note__type">Idé</span>
        </div>
        {onPinToBoard ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-side-note__pin size-7"
            aria-label="Fastgør på opslagstavle"
            title="Fastgør på opslagstavle"
            onClick={onPinToBoard}
          >
            <Pin className="size-3.5" aria-hidden />
          </Button>
        ) : null}
        {onDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-side-note__delete size-7"
            aria-label="Slet idé"
            onClick={onDelete}
          >
            <Trash2 className="text-destructive size-3.5" aria-hidden />
          </Button>
        ) : null}
      </header>

      <input
        type="text"
        className="min-side-note__title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={() => {
          const trimmed = title.trim();
          if (!trimmed || trimmed === note.title) return;
          void save({ title: trimmed }).catch(() => {});
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        placeholder="Overskrift"
        aria-label="Overskrift"
      />

      <textarea
        className="min-side-note__body"
        value={content}
        rows={variant === "stack" ? 2 : 3}
        onChange={(event) => setContent(event.target.value)}
        onBlur={() => {
          const trimmed = content.trim();
          if (trimmed === note.content) return;
          void save({ content: trimmed }).catch(() => {});
        }}
        placeholder="Skriv noter her…"
        aria-label="Indhold"
      />
    </article>
  );
}
