"use client";

import { useCallback, useEffect, useState } from "react";
import { StickyNote } from "lucide-react";

import { EditablePostItFields } from "@/components/personal/editable-post-it-fields";
import { Button } from "@/components/ui/button";
import { apiGet, apiPatch } from "@/lib/api";
import { personalNoteColorClass } from "@/lib/personal-note-colors";
import { cn } from "@/lib/utils";
import type { PersonalNote, PersonalNoteVisibility } from "@/types/personal";

function visibilityLabel(visibility: PersonalNoteVisibility | string | null | undefined): string {
  return visibility === "team" ? "Alle på sagen" : "Kun mig";
}

export function TicketPostItsPanel({
  ticketId,
  currentUserId,
}: {
  ticketId: string;
  currentUserId: string;
}) {
  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<PersonalNote[]>(`/api/v1/personal/tickets/${ticketId}/post-its`);
      setNotes(data);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const detach = async (noteId: string) => {
    const updated = await apiPatch<PersonalNote>(`/api/v1/personal/notes/${noteId}`, {
      ticket_id: null,
    });
    setNotes((prev) => prev.filter((n) => n.id !== updated.id));
  };

  if (loading) {
    return (
      <section className="wire-card mb-0">
        <p className="text-muted-foreground text-sm">Henter sedler…</p>
      </section>
    );
  }

  if (notes.length === 0) {
    return null;
  }

  return (
    <section className="wire-card mb-0 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <StickyNote className="text-star-blue size-4" aria-hidden />
        <h2 className="wire-sec-title text-base">Sedler på sagen</h2>
        <span className="text-muted-foreground text-xs">({notes.length})</span>
      </div>
      <ul className="ticket-post-its-panel__list">
        {notes.map((note, index) => {
          const isOwner = note.user_id === currentUserId;
          return (
            <li
              key={note.id}
              className={cn(
                "ticket-post-its-panel__item post-it-note",
                personalNoteColorClass(note.color),
                index % 2 === 0 ? "-rotate-[0.6deg]" : "rotate-[0.8deg]",
              )}
            >
              <div className="ticket-post-its-panel__meta">
                <span className="ticket-post-its-panel__visibility">
                  {visibilityLabel(note.visibility)}
                </span>
                {note.author_name && !isOwner ? (
                  <span className="text-muted-foreground text-xs">{note.author_name}</span>
                ) : null}
                {isOwner ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7 px-2 text-xs"
                    onClick={() => void detach(note.id).catch(() => {})}
                  >
                    Fjern fra sag
                  </Button>
                ) : null}
              </div>
              {isOwner ? (
                <EditablePostItFields
                  note={note}
                  onNoteUpdated={(updated) =>
                    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
                  }
                  compact
                />
              ) : (
                <>
                  <p className="post-it-edit__title">{note.title}</p>
                  {note.content ? <p className="post-it-edit__body">{note.content}</p> : null}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
