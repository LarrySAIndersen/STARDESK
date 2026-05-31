"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { StickyNote, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { isStaff, isStardeskReviewer } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { ReviewNote, ReviewNoteCreatePayload } from "@/types/review-note";
import type { User } from "@/types/user";

type DraftNote = Readonly<{
  x: number;
  y: number;
  comment: string;
}>;

function pageTitleFromPath(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  const segment = pathname.split("/").filter(Boolean)[0] ?? "Side";
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
}

function ReviewNotePin({
  note,
  canEdit,
  onResolved,
}: {
  note: ReviewNote;
  canEdit: boolean;
  onResolved: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="review-note-pin"
        style={{ left: note.position_x, top: note.position_y }}
        aria-label={`Forbedring: ${note.comment.slice(0, 40)}`}
        onClick={() => setOpen(true)}
      >
        <StickyNote className="size-4" aria-hidden />
      </button>
      {open ? (
        <div
          className="review-note-popover"
          style={{ left: note.position_x + 8, top: note.position_y + 28 }}
          role="dialog"
          aria-label="Forbedring"
        >
          <div className="review-note-popover__header">
            <strong className="text-sm">Forbedring</strong>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground rounded p-0.5"
              aria-label="Luk"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
            </button>
          </div>
          <p className="review-note-popover__meta">
            {note.created_by_name} · {note.status === "open" ? "Åben" : "Løst"}
          </p>
          <p className="review-note-popover__comment">{note.comment}</p>
          {canEdit && note.status === "open" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2 w-full"
              onClick={async () => {
                await apiPatch(`/api/v1/review-notes/${note.id}`, { status: "resolved" });
                onResolved();
                setOpen(false);
              }}
            >
              Markér som løst
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function ReviewNoteComposer({
  draft,
  saving,
  onChange,
  onCancel,
  onSave,
}: {
  draft: DraftNote;
  saving: boolean;
  onChange: (comment: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div
      className="review-note-composer"
      style={{ left: draft.x, top: draft.y }}
      role="dialog"
      aria-label="Ny forbedring"
    >
      <div className="review-note-composer__header">
        <StickyNote className="size-4 text-amber-700" aria-hidden />
        <strong className="text-sm">Ny forbedring</strong>
      </div>
      <Textarea
        value={draft.comment}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Skriv din kommentar…"
        rows={4}
        className="review-note-composer__textarea"
        autoFocus
      />
      <div className="review-note-composer__actions">
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={saving}>
          Annuller
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={saving || draft.comment.trim().length === 0}
        >
          {saving ? "Gemmer…" : "Gem seddel"}
        </Button>
      </div>
    </div>
  );
}

export function ReviewNotesOverlay({ user }: { user: User | null }) {
  const pathname = usePathname();
  const reviewer = isStardeskReviewer(user);
  const staff = isStaff(user);
  const canPlaceNotes = reviewer;
  const canViewNotes = reviewer || staff;

  const [reviewMode, setReviewMode] = useState(reviewer);
  const [notes, setNotes] = useState<ReviewNote[]>([]);
  const [draft, setDraft] = useState<DraftNote | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadNotes = useCallback(async () => {
    if (!canViewNotes || !pathname) return;
    try {
      const data = await apiGet<ReviewNote[]>(
        `/api/v1/review-notes?page_path=${encodeURIComponent(pathname)}`,
      );
      setNotes(data);
      setLoadError(null);
    } catch {
      setLoadError("Kunne ikke hente sedler på siden.");
    }
  }, [canViewNotes, pathname]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    if (reviewer) {
      setReviewMode(true);
    }
  }, [reviewer]);

  if (!canViewNotes || pathname === "/forbedringer") {
    return null;
  }

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!canPlaceNotes || !reviewMode || draft) return;
    if ((event.target as HTMLElement).closest(".review-notes-toolbar")) return;
    if ((event.target as HTMLElement).closest(".review-note-pin")) return;
    if ((event.target as HTMLElement).closest(".review-note-popover")) return;
    if ((event.target as HTMLElement).closest(".review-note-composer")) return;

    const rect = event.currentTarget.getBoundingClientRect();
    setDraft({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      comment: "",
    });
  };

  const saveDraft = async () => {
    if (!draft || !pathname) return;
    setSaving(true);
    try {
      const payload: ReviewNoteCreatePayload = {
        page_path: pathname,
        page_title: pageTitleFromPath(pathname),
        comment: draft.comment.trim(),
        position_x: draft.x,
        position_y: draft.y,
      };
      const created = await apiPost<ReviewNote>("/api/v1/review-notes", payload);
      setNotes((prev) => [created, ...prev]);
      setDraft(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {reviewer ? (
        <div className="review-notes-toolbar">
          <label className="review-notes-toolbar__toggle">
            <input
              type="checkbox"
              checked={reviewMode}
              onChange={(event) => setReviewMode(event.target.checked)}
            />
            <span>Review-tilstand</span>
          </label>
          <span className="review-notes-toolbar__hint">
            {reviewMode ? "Klik på siden for at placere en gul seddel" : "Slå til for at tilføje sedler"}
          </span>
        </div>
      ) : null}

      <div
        className={cn(
          "review-notes-layer",
          reviewMode && canPlaceNotes && "review-notes-layer--active",
        )}
        onClick={handleOverlayClick}
        aria-hidden={!reviewMode}
      >
        {notes.map((note) => (
          <ReviewNotePin
            key={note.id}
            note={note}
            canEdit={staff || (reviewer && note.created_by_user_id === user?.id)}
            onResolved={() => void loadNotes()}
          />
        ))}
        {draft ? (
          <ReviewNoteComposer
            draft={draft}
            saving={saving}
            onChange={(comment) => setDraft({ ...draft, comment })}
            onCancel={() => setDraft(null)}
            onSave={() => void saveDraft()}
          />
        ) : null}
      </div>

      {loadError ? (
        <p className="review-notes-error" role="alert">
          {loadError}
        </p>
      ) : null}
    </>
  );
}
