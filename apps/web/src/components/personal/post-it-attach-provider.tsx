"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { StickyNote } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiPatch } from "@/lib/api";
import { readDraggedNoteId } from "@/lib/personal-board-dnd";
import { cn } from "@/lib/utils";
import type { PersonalNote, PersonalNoteUpdate } from "@/types/personal";

export type PersonalNoteVisibility = "private" | "team";

type PendingAttach = {
  noteId: string;
  ticketId: string;
  ticketNumber: string;
  ticketTitle: string;
};

type PostItAttachContextValue = {
  requestAttach: (pending: PendingAttach) => void;
};

const PostItAttachContext = createContext<PostItAttachContextValue | null>(null);

export function usePostItAttach(): PostItAttachContextValue {
  const ctx = useContext(PostItAttachContext);
  if (!ctx) {
    throw new Error("usePostItAttach must be used within PostItAttachProvider");
  }
  return ctx;
}

export function PostItAttachProvider({
  children,
  onNoteUpdated,
  onAttached,
}: {
  children: ReactNode;
  onNoteUpdated?: (note: PersonalNote) => void;
  onAttached?: (note: PersonalNote) => void;
}) {
  const [pending, setPending] = useState<PendingAttach | null>(null);
  const [visibility, setVisibility] = useState<PersonalNoteVisibility>("private");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestAttach = useCallback((next: PendingAttach) => {
    setVisibility("private");
    setError(null);
    setPending(next);
  }, []);

  const close = () => {
    if (busy) return;
    setPending(null);
    setError(null);
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const payload: PersonalNoteUpdate = {
        ticket_id: pending.ticketId,
        visibility,
      };
      const updated = await apiPatch<PersonalNote>(
        `/api/v1/personal/notes/${pending.noteId}`,
        payload,
      );
      onNoteUpdated?.(updated);
      onAttached?.(updated);
      setPending(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke fastgøre seddel på sagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PostItAttachContext.Provider value={{ requestAttach }}>
      {children}
      {pending ? (
        <div className="post-it-attach-backdrop" role="presentation" onClick={close}>
          <div
            className="post-it-attach-dialog"
            role="dialog"
            aria-labelledby="post-it-attach-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="post-it-attach-dialog__header">
              <StickyNote className="size-4 text-star-blue" aria-hidden />
              <h2 id="post-it-attach-title" className="text-sm font-semibold">
                Fastgør seddel på sag
              </h2>
            </div>
            <p className="text-muted-foreground text-sm">
              <span className="text-star-blue font-semibold">{pending.ticketNumber}</span>
              {" — "}
              {pending.ticketTitle}
            </p>

            <fieldset className="post-it-attach-dialog__visibility">
              <legend className="sr-only">Synlighed</legend>
              <Label className="post-it-attach-dialog__option">
                <input
                  type="radio"
                  name="post-it-visibility"
                  checked={visibility === "private"}
                  onChange={() => setVisibility("private")}
                />
                <span>
                  <strong>Kun mig</strong>
                  <span className="text-muted-foreground block text-xs">
                    Sedlen vises kun for dig på sagen.
                  </span>
                </span>
              </Label>
              <Label className="post-it-attach-dialog__option">
                <input
                  type="radio"
                  name="post-it-visibility"
                  checked={visibility === "team"}
                  onChange={() => setVisibility("team")}
                />
                <span>
                  <strong>Alle på sagen</strong>
                  <span className="text-muted-foreground block text-xs">
                    Kolleger med adgang til sagen kan også se sedlen.
                  </span>
                </span>
              </Label>
            </fieldset>

            {error ? <p className="text-destructive text-sm">{error}</p> : null}

            <div className="post-it-attach-dialog__actions">
              <Button type="button" variant="outline" onClick={close} disabled={busy}>
                Annuller
              </Button>
              <Button type="button" onClick={() => void confirm()} disabled={busy}>
                {busy ? "Fastgør…" : "Fastgør på sag"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </PostItAttachContext.Provider>
  );
}

export function TicketPostItDropTarget({
  ticketId,
  ticketNumber,
  ticketTitle,
  children,
  className,
}: {
  ticketId: string;
  ticketNumber: string;
  ticketTitle: string;
  children: ReactNode;
  className?: string;
}) {
  const { requestAttach } = usePostItAttach();
  const [active, setActive] = useState(false);

  return (
    <div
      className={cn(className, active && "ticket-post-it-drop--active")}
      onDragOver={(e) => {
        const noteId = e.dataTransfer.types.includes("application/x-stardesk-personal-note");
        if (!noteId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "link";
        setActive(true);
      }}
      onDragLeave={() => setActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setActive(false);
        const noteId = readDraggedNoteId(e.dataTransfer);
        if (!noteId) return;
        requestAttach({ noteId, ticketId, ticketNumber, ticketTitle });
      }}
    >
      {children}
    </div>
  );
}
