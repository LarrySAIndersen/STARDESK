"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Plus, Trash2 } from "lucide-react";

import { EditablePostItFields } from "@/components/personal/editable-post-it-fields";
import { Button } from "@/components/ui/button";
import { apiDelete, apiPost } from "@/lib/api";
import {
  beginNoteDrag,
  endNoteDrag,
  isNoteDragActive,
  readDraggedNoteId,
  shouldBlockNoteDrag,
} from "@/lib/personal-board-dnd";
import {
  PERSONAL_NOTE_COLORS,
  personalNoteColorClass,
  type PersonalNoteColorId,
} from "@/lib/personal-note-colors";
import { cn } from "@/lib/utils";
import type { PersonalNote } from "@/types/personal";

const STACK_OFFSETS = [
  { rotate: -4, x: 0, y: 0 },
  { rotate: 2.5, x: 5, y: 7 },
  { rotate: -1.5, x: 9, y: 14 },
  { rotate: 3, x: 3, y: 21 },
] as const;

export function PersonalNoteStack({
  notes,
  onNotesChange,
  onNoteDropToStack,
}: {
  notes: PersonalNote[];
  onNotesChange: (notes: PersonalNote[]) => void;
  onNoteDropToStack?: (noteId: string) => void;
}) {
  const [stackDragOver, setStackDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const bootstrappedRef = useRef(false);

  const trayNotes = useMemo(
    () =>
      [...notes]
        .filter((n) => !n.is_pinned)
        .sort((a, b) => a.sort_order - b.sort_order || b.updated_at.localeCompare(a.updated_at)),
    [notes],
  );

  const createFreshNote = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const color = PERSONAL_NOTE_COLORS[notes.length % PERSONAL_NOTE_COLORS.length]
        .id as PersonalNoteColorId;
      const created = await apiPost<PersonalNote>("/api/v1/personal/notes", {
        title: "Ny seddel",
        content: "",
        color,
      });
      onNotesChange([...notes, created]);
    } finally {
      setBusy(false);
    }
  }, [busy, notes, onNotesChange]);

  useEffect(() => {
    if (bootstrappedRef.current || notes.length > 0 || busy) return;
    bootstrappedRef.current = true;
    void createFreshNote();
  }, [busy, createFreshNote, notes.length]);

  const deleteTopNote = useCallback(
    async (noteId: string) => {
      await apiDelete(`/api/v1/personal/notes/${noteId}`);
      onNotesChange(notes.filter((n) => n.id !== noteId));
    },
    [notes, onNotesChange],
  );

  const handleNoteUpdated = useCallback(
    (updated: PersonalNote) => {
      onNotesChange(notes.map((n) => (n.id === updated.id ? updated : n)));
    },
    [notes, onNotesChange],
  );

  const handleStackDragOver = (e: DragEvent<HTMLElement>) => {
    if (!isNoteDragActive(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setStackDragOver(true);
  };

  const handleStackDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setStackDragOver(false);
    const noteId = readDraggedNoteId(e.dataTransfer);
    endNoteDrag();
    if (noteId && onNoteDropToStack) onNoteDropToStack(noteId);
  };

  const topNote = trayNotes[0];
  const underNotes = trayNotes.slice(1, 4);
  const padLayers = PERSONAL_NOTE_COLORS.filter(
    (c) => !underNotes.some((n) => n.color === c.id) && topNote?.color !== c.id,
  ).slice(0, Math.max(0, 4 - trayNotes.length));

  return (
    <aside
      className={cn("post-it-stack", stackDragOver && "post-it-stack--drop-active")}
      aria-label="Friske sedler — træk op på tavlen"
      onDragOver={handleStackDragOver}
      onDragLeave={() => setStackDragOver(false)}
      onDrop={handleStackDrop}
    >
      <p className="post-it-stack__label">Friske sedler</p>

      <div className="post-it-stack__pile">
        {padLayers.map((color, index) => {
          const offset = STACK_OFFSETS[trayNotes.length + index] ?? STACK_OFFSETS[3];
          return (
            <div
              key={`pad-${color.id}`}
              className={cn(
                "post-it-stack__sheet post-it-note",
                personalNoteColorClass(color.id),
              )}
              style={{
                zIndex: index + 1,
                transform: `rotate(${offset.rotate}deg) translate(${offset.x}px, ${offset.y}px)`,
              }}
              aria-hidden
            />
          );
        })}

        {underNotes.map((note, index) => {
          const layerIndex = trayNotes.length - 1 - index;
          const offset = STACK_OFFSETS[layerIndex] ?? STACK_OFFSETS[3];
          return (
            <div
              key={note.id}
              className={cn(
                "post-it-stack__sheet post-it-note",
                personalNoteColorClass(note.color),
              )}
              style={{
                zIndex: layerIndex + 2,
                transform: `rotate(${offset.rotate}deg) translate(${offset.x}px, ${offset.y}px)`,
              }}
              aria-hidden
            >
              <span className="post-it-stack__peek">{note.title}</span>
            </div>
          );
        })}

        {topNote ? (
          <div
            draggable
            onDragStart={(e) => {
              if (shouldBlockNoteDrag(e.target)) {
                e.preventDefault();
                return;
              }
              beginNoteDrag(e.dataTransfer, topNote.id);
            }}
            onDragEnd={() => endNoteDrag()}
            className={cn(
              "post-it-stack__top post-it-note group cursor-grab active:cursor-grabbing",
              personalNoteColorClass(topNote.color),
            )}
            style={{ zIndex: 10 }}
          >
            <div className="post-it-stack__top-actions" data-no-drag>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="post-it-stack__delete size-6 opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Slet seddel"
                onClick={() => void deleteTopNote(topNote.id).catch(() => {})}
              >
                <Trash2 className="text-destructive size-3" aria-hidden />
              </Button>
            </div>
            <EditablePostItFields
              note={topNote}
              onNoteUpdated={handleNoteUpdated}
              compact
            />
            <p className="post-it-stack__hint">Træk op på tavlen</p>
          </div>
        ) : (
          <button
            type="button"
            className={cn(
              "post-it-stack__top post-it-stack__fresh post-it-note",
              personalNoteColorClass(PERSONAL_NOTE_COLORS[0].id),
            )}
            style={{ zIndex: 10 }}
            disabled={busy}
            onClick={() => void createFreshNote()}
          >
            <span className="post-it-stack__title">Ny seddel</span>
            <span className="post-it-stack__hint">Klik for frisk seddel</span>
          </button>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="post-it-stack__add"
        disabled={busy}
        onClick={() => void createFreshNote()}
      >
        <Plus className="size-3.5" aria-hidden />
        Frisk seddel
      </Button>
    </aside>
  );
}
