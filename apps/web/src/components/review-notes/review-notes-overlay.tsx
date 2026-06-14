"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { StickyNote, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiPatch, apiPost, deleteReviewNote } from "@/lib/api";
import {
  blobToBase64,
  scheduleReviewScreenshotCapture,
} from "@/lib/capture-review-screenshot";
import { isStaff, isStardeskReviewer } from "@/lib/auth";
import { isForbedringerAdminPath } from "@/lib/review-notes-paths";
import { cn } from "@/lib/utils";
import type { ReviewNote, ReviewNoteCreatePayload } from "@/types/review-note";
import type { User } from "@/types/user";

type DraftNote = Readonly<{
  x: number;
  y: number;
  comment: string;
}>;

const REVIEW_OVERLAY_INTERACTIVE_SELECTOR = [
  ".review-notes-toolbar",
  ".review-note-pin",
  ".review-note-popover",
  ".review-note-composer",
  ".wire-topheader__helpabot",
  ".case-assistant-fab",
  ".case-assistant-panel",
].join(",");

function pageTitleFromPath(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  const segment = pathname.split("/").filter(Boolean)[0] ?? "Side";
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
}

function ReviewNotePin({
  note,
  canEdit,
  canDelete,
  onResolved,
  onDeleted,
}: {
  note: ReviewNote;
  canEdit: boolean;
  canDelete: boolean;
  onResolved: () => void;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <button
        type="button"
        className="review-note-pin"
        style={{ left: note.position_x, top: note.position_y }}
        aria-label={`${note.review_number || "Forbedring"}: ${note.comment.slice(0, 40)}`}
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
            <strong className="text-sm">Forbedring {note.review_number}</strong>
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
          {canDelete ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="mt-2 w-full"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                try {
                  await deleteReviewNote(note.id);
                  setOpen(false);
                  onDeleted();
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? "Sletter…" : "Slet seddel"}
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
  screenshotPending,
  onChange,
  onCancel,
  onSave,
}: {
  draft: DraftNote;
  saving: boolean;
  screenshotPending: boolean;
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
        <StickyNote className="text-star-red size-4" aria-hidden />
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
          {saving ? "Gemmer…" : screenshotPending ? "Gem seddel (foto…)" : "Gem seddel"}
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
  const overlayActive = canViewNotes && !isForbedringerAdminPath(pathname);

  const [reviewMode, setReviewMode] = useState(reviewer);
  const [notes, setNotes] = useState<ReviewNote[]>([]);
  const [draft, setDraft] = useState<DraftNote | null>(null);
  const [saving, setSaving] = useState(false);
  const [screenshotPending, setScreenshotPending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const draftScreenshotRef = useRef<Blob | null>(null);
  const screenshotPendingRef = useRef(false);

  const loadNotes = useCallback(async () => {
    if (!overlayActive || !pathname) return;
    try {
      const data = await apiGet<ReviewNote[]>(
        `/api/v1/review-notes?page_path=${encodeURIComponent(pathname)}`,
      );
      setNotes(data.filter((note) => note.status !== "deleted"));
      setLoadError(null);
    } catch {
      setLoadError("Kunne ikke hente sedler på siden.");
    }
  }, [overlayActive, pathname]);

  useEffect(() => {
    fireAndForget(loadNotes());
  }, [loadNotes]);

  useEffect(() => {
    if (reviewer) {
      setReviewMode(true);
    }
  }, [reviewer]);

  useEffect(() => {
    if (!overlayActive) {
      setDraft(null);
    }
  }, [overlayActive]);

  const draftPositionKey =
    draft != null ? `${draft.x},${draft.y}` : null;

  useEffect(() => {
    if (!overlayActive || draftPositionKey == null) {
      draftScreenshotRef.current = null;
      setScreenshotPending(false);
      return;
    }

    draftScreenshotRef.current = null;
    screenshotPendingRef.current = true;
    setScreenshotPending(true);
    const cancelCapture = scheduleReviewScreenshotCapture((blob) => {
      draftScreenshotRef.current = blob;
      screenshotPendingRef.current = false;
      setScreenshotPending(false);
    });

    return cancelCapture;
  }, [draftPositionKey, overlayActive]);

  if (!overlayActive) {
    return null;
  }

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!canPlaceNotes || !reviewMode || draft) return;
    if ((event.target as HTMLElement).closest(REVIEW_OVERLAY_INTERACTIVE_SELECTOR)) return;

    const rect = event.currentTarget.getBoundingClientRect();
    setDraft({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      comment: "",
    });
  };

  const waitForDraftScreenshot = async (timeoutMs: number): Promise<Blob | null> => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (draftScreenshotRef.current) {
        return draftScreenshotRef.current;
      }
      if (!screenshotPendingRef.current) {
        return draftScreenshotRef.current;
      }
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 50);
      });
    }
    return draftScreenshotRef.current;
  };

  const saveDraft = async () => {
    if (!draft || !pathname) return;
    setSaving(true);
    try {
      const screenshotBlob = await waitForDraftScreenshot(4_000);
      const payload: ReviewNoteCreatePayload = {
        page_path: pathname,
        page_title: pageTitleFromPath(pathname),
        comment: draft.comment.trim(),
        position_x: draft.x,
        position_y: draft.y,
      };
      if (screenshotBlob) {
        payload.screenshot_base64 = await blobToBase64(screenshotBlob);
      }
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
            {reviewMode ? "Klik på siden for at placere en seddel" : "Slå til for at tilføje sedler"}
          </span>
        </div>
      ) : null}

      <div
        className={cn(
          "review-notes-layer",
          reviewMode && canPlaceNotes && "review-notes-layer--active",
        )}
        onClick={handleOverlayClick}
        onKeyDown={(event) => {
          if (!canPlaceNotes || !reviewMode || draft) return;
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          setDraft({
            x: rect.width / 2,
            y: rect.height / 2,
            comment: "",
          });
        }}
        tabIndex={reviewMode && canPlaceNotes ? 0 : -1}
        aria-hidden={!reviewMode}
      >
        {notes.map((note) => (
          <ReviewNotePin
            key={note.id}
            note={note}
            canEdit={staff || (reviewer && note.created_by_user_id === user?.id)}
            canDelete={canViewNotes}
            onResolved={() => fireAndForget(loadNotes())}
            onDeleted={() => setNotes((prev) => prev.filter((item) => item.id !== note.id))}
          />
        ))}
        {draft ? (
          <ReviewNoteComposer
            draft={draft}
            saving={saving}
            screenshotPending={screenshotPending}
            onChange={(comment) =>
              setDraft((prev) => (prev ? { ...prev, comment } : null))
            }
            onCancel={() => setDraft(null)}
            onSave={() => fireAndForget(saveDraft())}
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
