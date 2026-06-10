"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiPatch } from "@/lib/api";
import {
  PERSONAL_NOTE_CATEGORIES,
  personalNoteCategoryLabel,
  type PersonalNoteCategoryId,
} from "@/lib/personal-note-categories";
import {
  PERSONAL_NOTE_COLORS,
  resolveNoteColorId,
  type PersonalNoteColorId,
} from "@/lib/personal-note-colors";
import { cn } from "@/lib/utils";
import type {
  PersonalNote,
  PersonalNoteUpdate,
  PersonalNoteVisibility,
} from "@/types/personal";

type EditablePostItFieldsProps = Readonly<{
  note: PersonalNote;
  onNoteUpdated: (note: PersonalNote) => void;
  compact?: boolean;
}>;

export function EditablePostItFields({
  note,
  onNoteUpdated,
  compact = false,
}: EditablePostItFieldsProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const titleRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const skipOutsideCloseRef = useRef(false);

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
  }, [note.title, note.content, note.id]);

  useEffect(() => {
    if (editing) {
      titleRef.current?.focus();
      titleRef.current?.select();
    }
  }, [editing]);

  const patch = useCallback(
    async (payload: PersonalNoteUpdate) => {
      const updated = await apiPatch<PersonalNote>(`/api/v1/personal/notes/${note.id}`, payload);
      onNoteUpdated(updated);
    },
    [note.id, onNoteUpdated],
  );

  const saveTitle = useCallback(() => {
    const trimmed = title.trim();
    if (!trimmed || trimmed === note.title) return;
    fireAndForget(patch({ title: trimmed }).catch(() => {}));
  }, [note.title, patch, title]);

  const saveContent = useCallback(() => {
    const trimmed = content.trim();
    if (trimmed === note.content) return;
    fireAndForget(patch({ content: trimmed }).catch(() => {}));
  }, [content, note.content, patch]);

  const exitEditing = useCallback(() => {
    saveTitle();
    saveContent();
    setEditing(false);
  }, [saveContent, saveTitle]);

  const enterEditing = useCallback(() => {
    skipOutsideCloseRef.current = true;
    setEditing(true);
  }, []);

  useEffect(() => {
    if (!editing) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (skipOutsideCloseRef.current) {
        skipOutsideCloseRef.current = false;
        return;
      }
      if (!rootRef.current?.contains(event.target as Node)) {
        exitEditing();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [editing, exitEditing]);

  const categoryLabel = personalNoteCategoryLabel(note.category);
  const displayTitle = note.title.trim() || "Ny seddel";
  const displayContent = note.content.trim();

  if (!editing) {
    return (
      <div
        className="post-it-display"
        onDoubleClick={(event) => {
          event.stopPropagation();
          enterEditing();
        }}
        title="Dobbeltklik for at redigere"
      >
        <div className="post-it-edit__badges">
          {categoryLabel ? (
            <span className="post-it-edit__category-badge">{categoryLabel}</span>
          ) : null}
          {note.ticket_number ? (
            <span className="post-it-edit__ticket-badge">{note.ticket_number}</span>
          ) : null}
          {note.ticket_id ? (
            <span className="post-it-edit__visibility-badge">
              {note.visibility === "team" ? "Alle på sagen" : "Kun mig"}
            </span>
          ) : null}
        </div>
        <p className="post-it-display__title">{displayTitle}</p>
        {displayContent ? (
          <p className={cn("post-it-display__body", compact && "post-it-display__body--compact")}>
            {displayContent}
          </p>
        ) : (
          <p className="post-it-display__placeholder">Dobbeltklik for at skrive…</p>
        )}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="post-it-edit"
      data-no-drag
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          exitEditing();
        }
      }}
    >
      <div className="post-it-edit__badges">
        {categoryLabel ? (
          <span className="post-it-edit__category-badge">{categoryLabel}</span>
        ) : null}
        {note.ticket_number ? (
          <span className="post-it-edit__ticket-badge">{note.ticket_number}</span>
        ) : null}
        {note.ticket_id ? (
          <span className="post-it-edit__visibility-badge">
            {note.visibility === "team" ? "Alle på sagen" : "Kun mig"}
          </span>
        ) : null}
      </div>

      <input
        ref={titleRef}
        type="text"
        className="post-it-edit__title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={saveTitle}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        aria-label="Seddel-titel"
        placeholder="Titel"
      />

      <textarea
        className={cn("post-it-edit__body", compact && "post-it-edit__body--compact")}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={saveContent}
        rows={compact ? 2 : 3}
        placeholder="Tilføj tekst…"
        aria-label="Seddel-tekst"
      />

      <div className="post-it-edit__meta">
        <div className="post-it-edit__group" role="group" aria-label="Kategori">
          <span className="post-it-edit__meta-label">Kategori</span>
          <div className="post-it-edit__chips">
            {PERSONAL_NOTE_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={cn(
                  "post-it-edit__chip",
                  note.category === c.id && "post-it-edit__chip--active",
                )}
                title={c.label}
                onClick={() =>
                  fireAndForget(patch({
                    category: note.category === c.id ? null : (c.id as PersonalNoteCategoryId),
                  }).catch(() => {}))
                }
              >
                {compact ? c.shortLabel : c.label}
              </button>
            ))}
          </div>
        </div>

        {note.ticket_id ? (
          <div className="post-it-edit__group" role="group" aria-label="Synlighed på sag">
            <span className="post-it-edit__meta-label">Synlighed</span>
            <div className="post-it-edit__chips">
              {(
                [
                  { id: "private" as PersonalNoteVisibility, label: "Kun mig" },
                  { id: "team" as PersonalNoteVisibility, label: "Alle" },
                ] as const
              ).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={cn(
                    "post-it-edit__chip",
                    (note.visibility ?? "private") === v.id && "post-it-edit__chip--active",
                  )}
                  onClick={() => fireAndForget(patch({ visibility: v.id }).catch(() => {}))}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="post-it-edit__group" role="group" aria-label="Farve">
          <span className="post-it-edit__meta-label">Farve</span>
          <div className="post-it-edit__swatches">
            {PERSONAL_NOTE_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={cn(
                  "post-it-edit__swatch",
                  c.swatchClassName,
                  resolveNoteColorId(note.color) === c.id && "post-it-edit__swatch--active",
                )}
                aria-label={`Farve ${c.label}`}
                onClick={() =>
                  fireAndForget(patch({ color: c.id as PersonalNoteColorId }).catch(() => {}))
                }
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
