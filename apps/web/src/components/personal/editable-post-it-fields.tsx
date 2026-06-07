"use client";

import { useCallback, useEffect, useState } from "react";

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

export function EditablePostItFields({
  note,
  onNoteUpdated,
  compact = false,
}: {
  note: PersonalNote;
  onNoteUpdated: (note: PersonalNote) => void;
  compact?: boolean;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
  }, [note.title, note.content, note.id]);

  const patch = useCallback(
    async (payload: PersonalNoteUpdate) => {
      const updated = await apiPatch<PersonalNote>(`/api/v1/personal/notes/${note.id}`, payload);
      onNoteUpdated(updated);
    },
    [note.id, onNoteUpdated],
  );

  const saveTitle = () => {
    const trimmed = title.trim();
    if (!trimmed || trimmed === note.title) return;
    void patch({ title: trimmed }).catch(() => {});
  };

  const saveContent = () => {
    const trimmed = content.trim();
    if (trimmed === note.content) return;
    void patch({ content: trimmed }).catch(() => {});
  };

  const categoryLabel = personalNoteCategoryLabel(note.category);

  return (
    <div className="post-it-edit" data-no-drag>
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
                  void patch({
                    category: note.category === c.id ? null : (c.id as PersonalNoteCategoryId),
                  }).catch(() => {})
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
                  onClick={() => void patch({ visibility: v.id }).catch(() => {})}
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
                  void patch({ color: c.id as PersonalNoteColorId }).catch(() => {})
                }
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
