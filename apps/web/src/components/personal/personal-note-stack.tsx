"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import { useCallback, useMemo, useState, type DragEvent } from "react";
import { Plus, Trash2 } from "lucide-react";

import { EditablePostItFields } from "@/components/personal/editable-post-it-fields";
import { Button } from "@/components/ui/button";
import { apiDelete, apiPost } from "@/lib/api";
import {
  beginNoteDrag,
  isNoteDrag,
  readDraggedNoteId,
  shouldBlockNoteDrag,
} from "@/lib/personal-board-dnd";
import {
  noteTrayStackOffsetForIndex,
  pickPersonalNoteColorId,
  sortStackNotes,
} from "@/lib/personal-board-layout";
import {
  PERSONAL_NOTE_COLORS,
  personalNoteColorClass,
  type PersonalNoteColorId,
} from "@/lib/personal-note-colors";
import { cn } from "@/lib/utils";
import type { PersonalNote } from "@/types/personal";

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

  const trayNotes = useMemo(() => sortStackNotes(notes), [notes]);

  const createFreshNote = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const color = pickPersonalNoteColorId(PERSONAL_NOTE_COLORS, notes.length) as PersonalNoteColorId;
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
    if (!isNoteDrag(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setStackDragOver(true);
  };

  const handleStackDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setStackDragOver(false);
    const noteId = readDraggedNoteId(e.dataTransfer);
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
          const offset = noteTrayStackOffsetForIndex(trayNotes.length + index);
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
          const offset = noteTrayStackOffsetForIndex(layerIndex);
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
                onClick={() => fireAndForget(deleteTopNote(topNote.id).catch(() => {}))}
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
            onClick={() => fireAndForget(createFreshNote())}
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
        onClick={() => fireAndForget(createFreshNote())}
      >
        <Plus className="size-3.5" aria-hidden />
        Frisk seddel
      </Button>
    </aside>
  );
}
